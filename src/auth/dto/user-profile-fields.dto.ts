import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ContactItemDto } from '../../users/dto/contact-item.dto';

export class UserProfileFieldsDto {
  @ApiPropertyOptional({
    type: [ContactItemDto],
    description: 'Контакты: телефоны и ссылки на соцсети',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactItemDto)
  contacts?: ContactItemDto[];

  @ApiPropertyOptional({
    example: '+79991234567',
    description: 'Основной телефон',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Moscow' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: 'Short bio' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'More about me' })
  @IsOptional()
  @IsString()
  aboutMe?: string;
}
