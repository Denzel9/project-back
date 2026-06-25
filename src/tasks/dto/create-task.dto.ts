import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ format: 'uuid', description: 'UUID поста (только владелец поста)' })
  @IsUUID()
  postId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'UUID исполнителя задачи. Можно назначить позже через PATCH /tasks/:id',
  })
  @IsOptional()
  @IsUUID()
  executorId?: string;

  @ApiPropertyOptional({ description: 'Название задачи', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(500)
  title?: string | null;

  @ApiPropertyOptional({
    maxLength: 5000,
    description: 'Описание задачи в формате Markdown',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.PREPARING })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  finalDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoCount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoCount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Одобрение задачи исполнителем',
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @Type(() => Boolean)
  @IsBoolean()
  isExecutorApprove?: boolean | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isCompanyAction?: boolean;
}
