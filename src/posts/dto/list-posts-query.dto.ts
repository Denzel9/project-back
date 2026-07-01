import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ContentStyle,
  PlacementFormat,
  Platform,
  PostAuthorType,
  PostCurrency,
  BudgetType,
  UsageRights,
  WorkFormat,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  transformCsvArray,
  transformOptionalBoolean,
  transformTrimmedString,
} from '../../common/query/query-param.transforms';
import { API_PAYMENT_TERMS } from './post-budget.dto';

export class ListPostsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фильтр по владельцу. Без параметра — все посты, кроме своих',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({
    enum: PostAuthorType,
    description:
      'Фильтр по типу поста. Для чужих постов тип задаётся автоматически по роли (CREATOR видит COMPANY и наоборот)',
  })
  @IsOptional()
  @IsEnum(PostAuthorType)
  type?: PostAuthorType;

  @ApiPropertyOptional({ description: 'Фильтр по архивным постам' })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({
    description: 'Фильтр по приватным постам (только для своих постов через ownerId)',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    description: 'Поиск по названию поста или названию компании-автора',
    example: 'реклама',
  })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  q?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по названию поста (contains, без учёта регистра)',
  })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional({ description: 'Фильтр по срочности' })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Фильтр по chips (hasSome, через запятую)',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsArray()
  @IsString({ each: true })
  chips?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Фильтр по categories (hasSome, через запятую)',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    enum: Platform,
    isArray: true,
    description: 'Фильтр по platforms (hasSome, через запятую)',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsArray()
  @IsEnum(Platform, { each: true })
  platforms?: Platform[];

  @ApiPropertyOptional({
    enum: PlacementFormat,
    isArray: true,
    description: 'Фильтр по placementFormats (hasSome, через запятую)',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsArray()
  @IsEnum(PlacementFormat, { each: true })
  placementFormats?: PlacementFormat[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Фильтр по niche (hasSome, через запятую)',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsArray()
  @IsString({ each: true })
  niche?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Фильтр по tags (hasSome, через запятую)',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: WorkFormat })
  @IsOptional()
  @IsEnum(WorkFormat)
  workFormat?: WorkFormat;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Фильтр по дате создания (календарный день, UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'createdDate должен быть в формате YYYY-MM-DD',
  })
  createdDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Фильтр по дедлайну (календарный день, UTC)',
    example: '2026-06-14',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'deadlineDate должен быть в формате YYYY-MM-DD',
  })
  deadlineDate?: string;

  @ApiPropertyOptional({ enum: BudgetType })
  @IsOptional()
  @IsEnum(BudgetType)
  budgetType?: BudgetType;

  @ApiPropertyOptional({ enum: PostCurrency })
  @IsOptional()
  @IsEnum(PostCurrency)
  budgetCurrency?: PostCurrency;

  @ApiPropertyOptional({ enum: API_PAYMENT_TERMS })
  @IsOptional()
  @IsIn(API_PAYMENT_TERMS)
  paymentTerms?: (typeof API_PAYMENT_TERMS)[number];

  @ApiPropertyOptional({ description: 'Фильтр location.city (contains)' })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  locationCity?: string;

  @ApiPropertyOptional({ description: 'Фильтр location.country (contains)' })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  locationCountry?: string;

  @ApiPropertyOptional({ description: 'Фильтр location.shootingRequired' })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  shootingRequired?: boolean;

  @ApiPropertyOptional({ description: 'Фильтр bloggerRequirements.minFollowers' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minFollowers?: number;

  @ApiPropertyOptional({ description: 'Фильтр bloggerRequirements.maxFollowers' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxFollowers?: number;

  @ApiPropertyOptional({
    description: 'Фильтр bloggerRequirements.minEngagementRate',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minEngagementRate?: number;

  @ApiPropertyOptional({
    description: 'Фильтр bloggerRequirements.verifiedAccount',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  verifiedAccount?: boolean;

  @ApiPropertyOptional({
    description: 'Фильтр bloggerRequirements.experienceWithAds',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  experienceWithAds?: boolean;

  @ApiPropertyOptional({
    enum: ContentStyle,
    isArray: true,
    description: 'Фильтр bloggerRequirements.contentStyle (hasSome, через запятую)',
  })
  @IsOptional()
  @Transform(transformCsvArray)
  @IsArray()
  @IsEnum(ContentStyle, { each: true })
  contentStyle?: ContentStyle[];

  @ApiPropertyOptional({ description: 'Фильтр cooperationDetails.exclusivity' })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  exclusivity?: boolean;

  @ApiPropertyOptional({
    description: 'Фильтр cooperationDetails.exclusivityDays',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  exclusivityDays?: number;

  @ApiPropertyOptional({ enum: UsageRights })
  @IsOptional()
  @IsEnum(UsageRights)
  usageRights?: UsageRights;

  @ApiPropertyOptional({
    description: 'Фильтр cooperationDetails.usageDurationDays',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  usageDurationDays?: number;

  @ApiPropertyOptional({
    description: 'Фильтр cooperationDetails.requiresMarking',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  requiresMarking?: boolean;

  @ApiPropertyOptional({
    description: 'Фильтр cooperationDetails.requiresContract',
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  requiresContract?: boolean;

  @ApiPropertyOptional({ description: 'Фильтр cooperationDetails.ndaRequired' })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  ndaRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Фильтр brief.hashtags (вхождение значения)',
  })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  briefHashtag?: string;

  @ApiPropertyOptional({
    description: 'Фильтр brief.mentions (вхождение значения)',
  })
  @IsOptional()
  @Transform(transformTrimmedString)
  @IsString()
  @MinLength(1)
  briefMention?: string;

  @ApiPropertyOptional({ enum: Platform })
  @IsOptional()
  @IsEnum(Platform)
  deliverablePlatform?: Platform;

  @ApiPropertyOptional({ enum: PlacementFormat })
  @IsOptional()
  @IsEnum(PlacementFormat)
  deliverableFormat?: PlacementFormat;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
