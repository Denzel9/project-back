import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConfirmEmailDto {
  @ApiProperty({ description: 'Token из ссылки в письме подтверждения почты' })
  @IsString()
  @MinLength(1)
  token: string;
}
