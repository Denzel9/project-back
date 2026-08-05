import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TaskAnnulmentInitiator } from './task-annulment.dto';

export enum TaskDeadlineExtensionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}

export class RequestTaskDeadlineExtensionDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason: string;

  @ApiProperty({ enum: TaskAnnulmentInitiator })
  @IsEnum(TaskAnnulmentInitiator)
  initiator: TaskAnnulmentInitiator;

  @ApiProperty({
    format: 'date-time',
    description: 'Предлагаемая новая дата дедлайна (строго позже текущей)',
  })
  @IsDateString()
  proposedFinalDate: string;
}

export class TaskDeadlineExtensionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  reason: string;

  @ApiProperty({ enum: TaskAnnulmentInitiator })
  initiator: TaskAnnulmentInitiator;

  @ApiProperty({ format: 'date-time' })
  proposedFinalDate: string;

  @ApiProperty({ format: 'date-time' })
  requestedAt: string;

  @ApiProperty({ format: 'uuid' })
  requestedById: string;

  @ApiProperty({ enum: TaskDeadlineExtensionStatus })
  status: TaskDeadlineExtensionStatus;

  @ApiProperty({ format: 'date-time', nullable: true })
  confirmedAt: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  confirmedById: string | null;
}
