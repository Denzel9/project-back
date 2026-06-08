import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString({ message: 'Пароль должен быть строкой' })
  password: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Запомнить меня: refresh-токен и cookie живут 30 дней вместо 7',
  })
  @IsOptional()
  @IsBoolean({ message: 'rememberMe должно быть boolean' })
  rememberMe?: boolean;
}
