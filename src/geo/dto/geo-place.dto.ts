import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GeoPlaceDto {
  @ApiProperty({
    description: 'display_name из Nominatim (для формы)',
    example: 'Новое шоссе, 22, Боброво, городской округ Ленинский, Московская область, 142717, Россия',
  })
  label: string;

  @ApiPropertyOptional({ description: 'Полный display_name Nominatim' })
  display_name?: string | null;

  @ApiPropertyOptional()
  place_id?: number | null;

  @ApiPropertyOptional()
  osm_type?: string | null;

  @ApiPropertyOptional()
  osm_id?: number | null;

  @ApiPropertyOptional()
  licence?: string | null;

  @ApiPropertyOptional({ example: '55.5364375' })
  lat?: string | null;

  @ApiPropertyOptional({ example: '37.6103005' })
  lon?: string | null;

  @ApiPropertyOptional({ description: 'Класс объекта OSM', example: 'place' })
  class?: string | null;

  @ApiPropertyOptional({ description: 'Тип объекта OSM', example: 'house' })
  type?: string | null;

  @ApiPropertyOptional()
  place_rank?: number | null;

  @ApiPropertyOptional()
  importance?: number | null;

  @ApiPropertyOptional()
  addresstype?: string | null;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional({ type: [String] })
  boundingbox?: string[] | null;

  @ApiPropertyOptional({
    description: 'Разбор адреса Nominatim (все поля as-is)',
    additionalProperties: true,
  })
  address?: Record<string, string> | null;
}
