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
