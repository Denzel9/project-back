import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateFavoriteGroupDto {
  @ApiProperty({ example: 'спорт' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
