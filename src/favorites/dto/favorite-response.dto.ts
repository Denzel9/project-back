import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostResponseDto } from '../../posts/dto/post-response.dto';
import { FavoriteListType } from './favorite-list-type.enum';
import { FavoriteUserProfileDto } from './favorite-user-response.dto';

export class FavoriteResponseDto {
  @ApiProperty({ enum: FavoriteListType, example: FavoriteListType.POST })
  type: FavoriteListType.POST;

  @ApiProperty({ format: 'uuid' })
  postId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'null — без группы',
  })
  groupId: string | null;

  @ApiPropertyOptional({
    example: 'спорт',
    nullable: true,
    description: 'null — без группы',
  })
  groupName: string | null;

  @ApiProperty({ format: 'date-time' })
  savedAt: string;

  @ApiProperty({ type: PostResponseDto })
  post: PostResponseDto;
}

export class FavoriteUserItemResponseDto {
  @ApiProperty({ enum: FavoriteListType })
  type: FavoriteListType.CREATOR | FavoriteListType.COMPANY;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'date-time' })
  savedAt: string;

  @ApiProperty({ type: FavoriteUserProfileDto })
  user: FavoriteUserProfileDto;
}
