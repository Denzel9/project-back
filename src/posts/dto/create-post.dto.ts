import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostContentType, TypeCooperation } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Заголовок поста' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chips?: string[];

  @ApiPropertyOptional({ example: '', default: '' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: TypeCooperation,
    isArray: true,
    example: [TypeCooperation.ONE_TIME],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TypeCooperation, { each: true })
  typeCooperation?: TypeCooperation[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({
    enum: PostContentType,
    example: PostContentType.PHOTO,
  })
  @IsOptional()
  @IsEnum(PostContentType)
  contentType?: PostContentType;

  @ApiPropertyOptional({ example: '0', default: '0' })
  @IsOptional()
  @IsString()
  photoCount?: string;

  @ApiPropertyOptional({ example: '0', default: '0' })
  @IsOptional()
  @IsString()
  videoCount?: string;

  @ApiPropertyOptional({ example: '5000', default: '' })
  @IsOptional()
  @IsString()
  finalPrice?: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rangePrice?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyWords?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}
