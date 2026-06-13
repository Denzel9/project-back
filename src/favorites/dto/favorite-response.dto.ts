import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostResponseDto } from '../../posts/dto/post-response.dto';

export class FavoriteResponseDto {
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
