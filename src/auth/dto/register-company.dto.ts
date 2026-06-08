import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { UserProfileFieldsDto } from './user-profile-fields.dto';

export class RegisterCompanyDto extends UserProfileFieldsDto {
  @ApiProperty({ example: 'company@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Acme Inc.' })
  @IsString()
  companyName: string;
}
