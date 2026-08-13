import { ApiProperty } from '@nestjs/swagger';

export class FileTemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  size: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
