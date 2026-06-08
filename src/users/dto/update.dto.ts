import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ContactItemDto } from './contact-item.dto';
import { UpdateCreatorProfileDto } from './update-creator.dto';
import { UpdateCompanyProfileDto } from './update-company.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Acme Inc.' })
  @IsOptional()
  @IsString()
  companyName?: string;

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
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'Moscow' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  @IsUrl()
  avatar?: string;

  @ApiPropertyOptional({ example: 'Short bio' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;

  @ApiPropertyOptional({ example: 'More about me' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  aboutMe?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.png' })
  @IsOptional()
  @IsString()
  @IsUrl()
  banner?: string;

  @ApiPropertyOptional({ type: UpdateCreatorProfileDto })
  @IsOptional()
  @IsObject()
  creatorProfile?: UpdateCreatorProfileDto;

  @ApiPropertyOptional({ type: UpdateCompanyProfileDto })
  @IsOptional()
  @IsObject()
  companyProfile?: UpdateCompanyProfileDto;
}
