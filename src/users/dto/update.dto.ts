import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ContactItemDto } from './contact-item.dto';
import { PersonDto } from './person.dto';
import { UpdateCreatorProfileDto } from './update-creator.dto';
import { UpdateCompanyProfileDto } from './update-company.dto';

const clearFieldDescription = 'Передайте null, чтобы удалить';

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
    nullable: true,
    description: `Контакты: телефоны и ссылки на соцсети. ${clearFieldDescription}`,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactItemDto)
  contacts?: ContactItemDto[] | null;

  @ApiPropertyOptional({
    type: PersonDto,
    nullable: true,
    description:
      'Антропометрия и параметры. Merge с существующим объектом; null на поле удаляет ключ; person: null — очистить весь блок',
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => PersonDto)
  person?: PersonDto | null;

  @ApiPropertyOptional({
    example: '+79991234567',
    nullable: true,
    description: `Основной телефон. ${clearFieldDescription}`,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiPropertyOptional({
    example: 'Moscow',
    nullable: true,
    description: clearFieldDescription,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  location?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.png',
    nullable: true,
    description: clearFieldDescription,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @IsUrl()
  avatar?: string | null;

  @ApiPropertyOptional({
    example: 'Short bio',
    nullable: true,
    description: clearFieldDescription,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(300)
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'More about me',
    nullable: true,
    description: clearFieldDescription,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(2000)
  aboutMe?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/banner.png',
    nullable: true,
    description: clearFieldDescription,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @IsUrl()
  banner?: string | null;

  @ApiPropertyOptional({ type: UpdateCreatorProfileDto })
  @IsOptional()
  @IsObject()
  creatorProfile?: UpdateCreatorProfileDto;

  @ApiPropertyOptional({ type: UpdateCompanyProfileDto })
  @IsOptional()
  @IsObject()
  companyProfile?: UpdateCompanyProfileDto;
}
