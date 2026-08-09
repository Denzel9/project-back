import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateTaskCommentPinDto {
  @ApiProperty({
    description: 'true — закрепить, false — открепить',
  })
  @IsBoolean()
  isPinned: boolean;
}
