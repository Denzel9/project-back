import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class PostBriefDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  taskDescription?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  references?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  brandGuidelinesUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  dosAndDonts?: string;
}
