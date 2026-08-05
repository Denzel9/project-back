import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BloggerRequirementsDto } from '../../posts/dto/blogger-requirements.dto';
import { CooperationDetailsDto } from '../../posts/dto/cooperation-details.dto';
import { PostBriefDto } from '../../posts/dto/post-brief.dto';
import { PostDeliverableDto } from '../../posts/dto/post-deliverable.dto';
import { PostLocationDto } from '../../posts/dto/post-location.dto';
import { TaskCommentMediaInputDto } from './task-comment-media-input.dto';

export class CreateTaskDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUID поста (только владелец поста)',
  })
  @IsUUID()
  postId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'UUID исполнителя задачи. Можно назначить позже через PATCH /tasks/:id',
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
    description:
      'Игнорируется при создании: вручную всегда `null`, из принятого отклика — `true`.',
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

  @ApiPropertyOptional({ type: PostLocationDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => PostLocationDto)
  location?: PostLocationDto | null;

  @ApiPropertyOptional({ type: BloggerRequirementsDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => BloggerRequirementsDto)
  bloggerRequirements?: BloggerRequirementsDto | null;

  @ApiPropertyOptional({ type: CooperationDetailsDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => CooperationDetailsDto)
  cooperationDetails?: CooperationDetailsDto | null;

  @ApiPropertyOptional({ type: PostBriefDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => PostBriefDto)
  brief?: PostBriefDto | null;

  @ApiPropertyOptional({ type: [PostDeliverableDto], nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostDeliverableDto)
  deliverables?: PostDeliverableDto[] | null;

  @ApiPropertyOptional({
    type: [TaskCommentMediaInputDto],
    description:
      'Вложения после загрузки в S3 (`POST /media/upload` без taskId или с `postId`). ' +
      'Привязываются к задаче как основные (kind=MAIN).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskCommentMediaInputDto)
  media?: TaskCommentMediaInputDto[];
}
