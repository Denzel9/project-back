import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export enum TaskAnnulmentInitiator {
  CUSTOMER = 'CUSTOMER',
  EXECUTOR = 'EXECUTOR',
  MUTUAL = 'MUTUAL',
}

export enum TaskAnnulmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}

export class RequestTaskAnnulmentDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason: string;

  @ApiProperty({ enum: TaskAnnulmentInitiator })
  @IsEnum(TaskAnnulmentInitiator)
  initiator: TaskAnnulmentInitiator;
}

export class TaskAnnulmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  reason: string;

  @ApiProperty({ enum: TaskAnnulmentInitiator })
  initiator: TaskAnnulmentInitiator;

  @ApiProperty({ format: 'date-time' })
  requestedAt: string;

  @ApiProperty({ format: 'uuid' })
  requestedById: string;

  @ApiProperty({ enum: TaskAnnulmentStatus })
  status: TaskAnnulmentStatus;

  @ApiProperty({ format: 'date-time', nullable: true })
  confirmedAt: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  confirmedById: string | null;
}
