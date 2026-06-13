import { ApiProperty } from '@nestjs/swagger';
import { PostAuthorType } from '@prisma/client';

export class ApplicationPostSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Заголовок поста' })
  title: string;

  @ApiProperty({ enum: PostAuthorType })
  type: PostAuthorType;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;
}
