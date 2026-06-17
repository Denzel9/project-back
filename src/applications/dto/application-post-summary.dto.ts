import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostAuthorType } from '@prisma/client';
import { ApplicationOwnerDto } from './application-owner.dto';
import { PostMediaDto } from 'src/posts/dto/post-media.dto';

export class ApplicationPostSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Заголовок поста' })
  title: string;

  @ApiProperty({ enum: PostAuthorType })
  type: PostAuthorType;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiPropertyOptional({ type: ApplicationOwnerDto })
  owner?: ApplicationOwnerDto;

  @ApiPropertyOptional({ type: [PostMediaDto] })
  media?: PostMediaDto[];
}
