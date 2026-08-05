import { ApiProperty } from '@nestjs/swagger';

export class PostOptionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;
}

export class PostOptionsResponseDto {
  @ApiProperty({ type: [PostOptionDto] })
  items: PostOptionDto[];
}
