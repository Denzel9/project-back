import { Prisma } from '@prisma/client';
import { buildCalendarDayFilter } from '../common/date/calendar-day-filter';
import { ListApplicationPartnersQueryDto } from './dto/list-application-partners-query.dto';
import { ListTaskPartnersQueryDto } from './dto/list-task-partners-query.dto';

function resolveStatuses<T extends string>(
  status: T | undefined,
  statuses: T[] | undefined
): T[] | undefined {
  if (statuses !== undefined && statuses.length > 0) {
    return statuses;
  }

  if (status !== undefined) {
    return [status];
  }

  return undefined;
}

export function buildTaskPartnerTaskFilters(
  query: ListTaskPartnersQueryDto
): Prisma.TaskWhereInput {
  const updatedAtFilter = buildCalendarDayFilter(query.updatedDate);
  const createdAtFilter = buildCalendarDayFilter(query.createdDate);
  const statusFilter = resolveStatuses(query.status, query.statuses);

  return {
    ...(query.postId !== undefined && { postId: query.postId }),
    ...(query.taskId !== undefined && { id: query.taskId }),
    ...(statusFilter !== undefined && { status: { in: statusFilter } }),
    ...(updatedAtFilter !== undefined && { updatedAt: updatedAtFilter }),
    ...(createdAtFilter !== undefined && { createdAt: createdAtFilter }),
    ...(query.isExecutorApprove !== undefined && {
      isExecutorApprove: query.isExecutorApprove,
    }),
    ...(query.urgent !== undefined && { urgent: query.urgent }),
  };
}

export function buildApplicationPartnerFilters(
  query: ListApplicationPartnersQueryDto
): Prisma.PostApplicationWhereInput {
  const updatedAtFilter = buildCalendarDayFilter(query.updatedDate);
  const createdAtFilter = buildCalendarDayFilter(query.createdDate);
  const statusFilter = resolveStatuses(query.status, query.statuses);

  return {
    ...(query.postId !== undefined && { postId: query.postId }),
    ...(statusFilter !== undefined && { status: { in: statusFilter } }),
    ...(updatedAtFilter !== undefined && { updatedAt: updatedAtFilter }),
    ...(createdAtFilter !== undefined && { createdAt: createdAtFilter }),
  };
}

export function buildCreatorNameSearch(q: string): Prisma.UserWhereInput {
  return {
    OR: [
      { creatorProfile: { name: { contains: q, mode: 'insensitive' } } },
      { creatorProfile: { lastName: { contains: q, mode: 'insensitive' } } },
    ],
  };
}

export function buildCompanyNameSearch(q: string): Prisma.UserWhereInput {
  return {
    companyProfile: {
      companyName: { contains: q, mode: 'insensitive' },
    },
  };
}

export function buildPostTitleSearch(q: string): Prisma.PostWhereInput {
  return {
    title: { contains: q, mode: 'insensitive' },
  };
}
