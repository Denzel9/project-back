import { ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetType, PostCurrency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const API_PAYMENT_TERMS = [
  'PREPAY',
  'POSTPAY',
  '50_50',
  'SAFE_DEAL',
] as const;

export type ApiPaymentTerms = (typeof API_PAYMENT_TERMS)[number];

export class PostBudgetDto {
  @ApiPropertyOptional({ enum: BudgetType })
  @IsOptional()
  @IsEnum(BudgetType)
  type?: BudgetType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ enum: PostCurrency })
  @IsOptional()
  @IsEnum(PostCurrency)
  currency?: PostCurrency;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({ enum: API_PAYMENT_TERMS })
  @IsOptional()
  @IsIn(API_PAYMENT_TERMS)
  paymentTerms?: ApiPaymentTerms;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  barterDescription?: string;
}
