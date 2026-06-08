import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({ description: 'Token из ссылки в письме-приглашении' })
  @IsString()
  token: string;
}
