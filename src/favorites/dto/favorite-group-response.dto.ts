import { ApiProperty } from '@nestjs/swagger';

export class FavoriteGroupResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'спорт' })
  name: string;

  @ApiProperty({ example: 3 })
  count: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
