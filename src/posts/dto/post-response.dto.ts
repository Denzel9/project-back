import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PostAuthorType,
  PostContentType,
  TypeCooperation,
} from '@prisma/client';
import { PostMediaDto } from './post-media.dto';
import { ApplicationOwnerDto } from 'src/applications/dto/application-owner.dto';

export class PostResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: [String], example: [] })
  permissions: string[];

  @ApiProperty({ type: [PostMediaDto] })
  media: PostMediaDto[];

  @ApiProperty({ example: 'Заголовок поста' })
  title: string;

  @ApiProperty({ type: [String], example: ['chip1'] })
  chips: string[];

  @ApiProperty({ example: 'Описание поста' })
  description: string;

  @ApiProperty({
    enum: TypeCooperation,
    isArray: true,
    example: [TypeCooperation.ONE_TIME],
  })
  typeCooperation: TypeCooperation[];

  @ApiProperty({ example: false })
  urgent: boolean;

  @ApiPropertyOptional({
    enum: PostContentType,
    example: PostContentType.PHOTO,
  })
  contentType: PostContentType;

  @ApiProperty({ example: '3' })
  photoCount: string;

  @ApiProperty({ example: '0' })
  videoCount: string;

  @ApiProperty({ example: '5000' })
  finalPrice: string;

  @ApiProperty({ type: [String], example: ['1000', '5000'] })
  rangePrice: string[];

  @ApiProperty({ example: false })
  isArchived: boolean;

  @ApiProperty({
    example: false,
    description:
      'Приватный пост виден только владельцу; исполнитель работает через задачу без доступа к посту',
  })
  isPrivate: boolean;

  @ApiProperty({ type: [String], example: ['keyword'] })
  keyWords: string[];

  @ApiProperty({ type: [String], example: ['category'] })
  categories: string[];

  @ApiProperty({ enum: PostAuthorType, example: PostAuthorType.CREATOR })
  type: PostAuthorType;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: ApplicationOwnerDto })
  owner?: ApplicationOwnerDto;
}
