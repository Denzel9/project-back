import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const MSK_OFFSET = '+03:00';
const TERMINAL_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.ANNULLED,
];

type DeadlineKind =
  | typeof NotificationType.TASK_DEADLINE_SOON
  | typeof NotificationType.TASK_DEADLINE_TODAY
  | typeof NotificationType.TASK_DEADLINE_OVERDUE;

const DEADLINE_COPY: Record<
  DeadlineKind,
  { title: string; bodyPrefix: string }
> = {
  [NotificationType.TASK_DEADLINE_SOON]: {
    title: 'Дедлайн завтра',
    bodyPrefix: 'Завтра истекает срок задачи',
  },
  [NotificationType.TASK_DEADLINE_TODAY]: {
    title: 'Дедлайн сегодня',
    bodyPrefix: 'Сегодня истекает срок задачи',
  },
  [NotificationType.TASK_DEADLINE_OVERDUE]: {
    title: 'Задача просрочена',
    bodyPrefix: 'Просрочена задача',
  },
};

/** Calendar YYYY-MM-DD in Europe/Moscow (UTC+3, no DST). */
export function getMoscowYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function shiftYmd(ymd: string, dayDelta: number): string {
  const base = new Date(`${ymd}T12:00:00${MSK_OFFSET}`);
  base.setTime(base.getTime() + dayDelta * 24 * 60 * 60 * 1000);
  return getMoscowYmd(base);
}

/** [start, end) UTC bounds for a Moscow calendar day. */
export function moscowDayBounds(ymd: string): { start: Date; end: Date } {
  const start = new Date(`${ymd}T00:00:00${MSK_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

@Injectable()
export class DeadlineReminderService {
  private readonly logger = new Logger(DeadlineReminderService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Europe/Moscow' })
  async handleDailyCron(): Promise<void> {
    await this.runForDate(new Date());
  }

  async runForDate(now: Date): Promise<void> {
    if (this.running) {
      this.logger.warn('Deadline reminder job already running, skip');
      return;
    }

    this.running = true;
    try {
      const todayYmd = getMoscowYmd(now);
      const tomorrowYmd = shiftYmd(todayYmd, 1);
      const yesterdayYmd = shiftYmd(todayYmd, -1);

      const windows: Array<{ type: DeadlineKind; ymd: string }> = [
        { type: NotificationType.TASK_DEADLINE_SOON, ymd: tomorrowYmd },
        { type: NotificationType.TASK_DEADLINE_TODAY, ymd: todayYmd },
        { type: NotificationType.TASK_DEADLINE_OVERDUE, ymd: yesterdayYmd },
      ];

      let sent = 0;

      for (const window of windows) {
        sent += await this.processWindow(window.type, window.ymd);
      }

      this.logger.log(
        `Deadline reminders for ${todayYmd} (MSK): sent ${sent}`
      );
    } catch (error) {
      this.logger.error('Deadline reminder job failed', error);
    } finally {
      this.running = false;
    }
  }

  private async processWindow(
    type: DeadlineKind,
    finalDateYmd: string
  ): Promise<number> {
    const { start, end } = moscowDayBounds(finalDateYmd);

    const tasks = await this.prisma.task.findMany({
      where: {
        finalDate: { gte: start, lt: end },
        status: { notIn: TERMINAL_STATUSES },
      },
      select: {
        id: true,
        title: true,
        postId: true,
        ownerId: true,
        executorId: true,
        finalDate: true,
      },
    });

    let sent = 0;

    for (const task of tasks) {
      if (!task.finalDate) continue;

      const recipientIds = Array.from(
        new Set(
          [task.ownerId, task.executorId].filter(
            (id): id is string => Boolean(id)
          )
        )
      );

      for (const recipientId of recipientIds) {
        const created = await this.sendOnce({
          type,
          taskId: task.id,
          postId: task.postId,
          title: task.title,
          finalDate: task.finalDate,
          recipientId,
        });
        if (created) sent += 1;
      }
    }

    return sent;
  }

  private async sendOnce(input: {
    type: DeadlineKind;
    taskId: string;
    postId: string;
    title: string | null;
    finalDate: Date;
    recipientId: string;
  }): Promise<boolean> {
    let logId: string;
    try {
      const log = await this.prisma.deadlineReminderLog.create({
        data: {
          taskId: input.taskId,
          recipientId: input.recipientId,
          type: input.type,
          finalDate: input.finalDate,
        },
        select: { id: true },
      });
      logId = log.id;
    } catch (error) {
      // Unique violation → already sent for this task/recipient/type/finalDate
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }

    const copy = DEADLINE_COPY[input.type];
    const taskLabel = input.title?.trim() || 'Без названия';

    try {
      await this.notificationsService.notify({
        recipientId: input.recipientId,
        type: input.type,
        title: copy.title,
        body: `${copy.bodyPrefix} «${taskLabel}»`,
        payload: {
          entityType: 'task',
          entityId: input.taskId,
          postId: input.postId,
          taskId: input.taskId,
          meta: {
            kind: input.type,
            finalDate: input.finalDate.toISOString(),
            taskTitle: input.title,
          },
        },
      });
    } catch (error) {
      await this.prisma.deadlineReminderLog.delete({ where: { id: logId } });
      throw error;
    }

    return true;
  }
}
