import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskTemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  title: string | null;

  @ApiProperty()
  description: string;

  @ApiProperty()
  photoCount: string;

  @ApiProperty()
  videoCount: string;

  @ApiProperty()
  urgent: boolean;

  @ApiPropertyOptional({ nullable: true })
  brief: unknown | null;

  @ApiPropertyOptional({ nullable: true })
  deliverables: unknown | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
