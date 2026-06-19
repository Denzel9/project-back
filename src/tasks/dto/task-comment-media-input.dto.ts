import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TaskCommentMediaInputDto {
  @ApiProperty({
    example:
      'https://8e99a641-b75a-4250-a2a3-d3ec2dbeb156.selstorage.ru/tasks/uuid/file.jpg',
  })
  @IsString()
  @MinLength(1)
  url: string;

  @ApiProperty({ example: 'tasks/uuid/file.jpg' })
  @IsString()
  @MinLength(1)
  key: string;

  @ApiProperty({ example: '12345' })
  @IsString()
  @MinLength(1)
  size: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MinLength(1)
  mimeType: string;
}
