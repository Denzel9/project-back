import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyPasswordDto {
  @ApiProperty({
    example: 'currentPassword123',
    description: 'Текущий пароль Account для проверки перед сменой',
  })
  @IsString({ message: 'Пароль должен быть строкой' })
  password: string;
}
