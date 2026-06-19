import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token из ссылки в письме сброса пароля' })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'newPassword123',
    minLength: 8,
    description: 'Новый пароль Account (мин. 8 символов)',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
