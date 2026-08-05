import { ApplicationStatus, TaskStatus } from '@prisma/client';

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.NEW]: 'новый',
  [ApplicationStatus.VIEWED]: 'просмотрен',
  [ApplicationStatus.ACCEPTED]: 'принят',
  [ApplicationStatus.REJECTED]: 'отклонён',
  [ApplicationStatus.WITHDRAWN]: 'отозван',
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.PREPARING]: 'подготовка',
  [TaskStatus.PENDING_APPROVAL]: 'ожидает одобрения',
  [TaskStatus.IN_PROGRESS]: 'в работе',
  [TaskStatus.CHECKING]: 'на проверке',
  [TaskStatus.REVISION]: 'доработка',
  [TaskStatus.COMPLETED]: 'завершена',
  [TaskStatus.ANNULLED]: 'аннулирована',
};

export function formatApplicationStatus(status: ApplicationStatus): string {
  return APPLICATION_STATUS_LABELS[status];
}

export function formatTaskStatus(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status];
}
