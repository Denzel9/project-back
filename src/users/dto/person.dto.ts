import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

const clearKeyDescription = 'Передайте null, чтобы удалить это поле из person';

export type Person = {
  height?: string;
  weight?: string;
  size?: string;
  birthday?: string;
  gender?: string;
  parameters?: string;
};

export class PersonDto {
  @ApiPropertyOptional({ example: '180', description: 'Рост', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  height?: string | null;

  @ApiPropertyOptional({ example: '75', description: 'Вес', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  weight?: string | null;

  @ApiPropertyOptional({
    example: 'M',
    description: 'Размер одежды',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  size?: string | null;

  @ApiPropertyOptional({
    example: '1995-06-15',
    description: 'Дата рождения',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  birthday?: string | null;

  @ApiPropertyOptional({ example: 'male', description: 'Пол', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  gender?: string | null;

  @ApiPropertyOptional({
    example: '90-60-90',
    description: 'Параметры / замеры',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  parameters?: string | null;
}

export type PersonPatch = {
  height?: string | null;
  weight?: string | null;
  size?: string | null;
  birthday?: string | null;
  gender?: string | null;
  parameters?: string | null;
};
