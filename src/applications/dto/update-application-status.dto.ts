import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

const ownerStatuses = [
  ApplicationStatus.VIEWED,
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
] as const;

export class UpdateApplicationStatusDto {
  @ApiProperty({
    enum: ownerStatuses,
    example: ApplicationStatus.ACCEPTED,
    description: 'VIEWED, ACCEPTED или REJECTED',
  })
  @IsEnum(ownerStatuses)
  status: (typeof ownerStatuses)[number];
}
