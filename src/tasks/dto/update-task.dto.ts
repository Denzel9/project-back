import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateTaskDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    maxLength: 5000,
    description:
      'Описание задачи в формате Markdown. Сервер хранит как есть, рендеринг на клиенте.',
    example: '## Требования\n\n- 3 фото\n- Дедлайн **завтра**',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

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
}
