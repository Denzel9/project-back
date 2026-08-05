import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * @param date YYYY-MM-DD
 * @param tzOffsetMinutes same as `Date#getTimezoneOffset()`:
 *   minutes to add to local time to get UTC (e.g. Moscow UTC+3 → -180).
 *   When omitted, the day is interpreted in UTC (legacy behaviour).
 */
export function buildCalendarDayFilter(
  date?: string,
  tzOffsetMinutes?: number
): Prisma.DateTimeFilter | undefined {
  if (date === undefined) {
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new BadRequestException('Некорректная дата');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const offsetMs = (tzOffsetMinutes ?? 0) * 60_000;

  const start = new Date(Date.UTC(year, month - 1, day) + offsetMs);
  const end = new Date(
    Date.UTC(year, month - 1, day, 23, 59, 59, 999) + offsetMs
  );

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException('Некорректная дата');
  }

  return { gte: start, lte: end };
}

export function buildCalendarDateRangeFilter(
  dateFrom?: string,
  dateTo?: string,
  tzOffsetMinutes?: number
): Prisma.DateTimeFilter | undefined {
  if (dateFrom === undefined && dateTo === undefined) {
    return undefined;
  }

  const filter: Prisma.DateTimeFilter = {};
  const offsetMs = (tzOffsetMinutes ?? 0) * 60_000;

  if (dateFrom !== undefined) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateFrom);

    if (!match) {
      throw new BadRequestException('dateFrom: некорректная дата');
    }

    const start = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      ) + offsetMs
    );

    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('dateFrom: некорректная дата');
    }

    filter.gte = start;
  }

  if (dateTo !== undefined) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateTo);

    if (!match) {
      throw new BadRequestException('dateTo: некорректная дата');
    }

    const end = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        23,
        59,
        59,
        999
      ) + offsetMs
    );

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
