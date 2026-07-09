import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function buildCalendarDayFilter(
  date?: string
): Prisma.DateTimeFilter | undefined {
  if (date === undefined) {
    return undefined;
  }

  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException('Некорректная дата');
  }

  return { gte: start, lte: end };
}

export function buildCalendarDateRangeFilter(
  dateFrom?: string,
  dateTo?: string
): Prisma.DateTimeFilter | undefined {
  if (dateFrom === undefined && dateTo === undefined) {
    return undefined;
  }

  const filter: Prisma.DateTimeFilter = {};

  if (dateFrom !== undefined) {
    const start = new Date(`${dateFrom}T00:00:00.000Z`);

    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('dateFrom: некорректная дата');
    }

    filter.gte = start;
  }

  if (dateTo !== undefined) {
    const end = new Date(`${dateTo}T23:59:59.999Z`);

    if (Number.isNaN(end.getTime())) {
      throw new BadRequestException('dateTo: некорректная дата');
    }

    filter.lte = end;
  }

  if (
    filter.gte !== undefined &&
    filter.lte !== undefined &&
    (filter.gte as Date).getTime() > (filter.lte as Date).getTime()
  ) {
    throw new BadRequestException('dateFrom не может быть позже dateTo');
  }

  return filter;
}
