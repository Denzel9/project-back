import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SwitchProfileDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'userId профиля из GET /auth/profiles, на который переключиться',
  })
  @IsUUID()
  userId: string;
}
