import { ApiProperty } from '@nestjs/swagger';

export class VerifyPasswordResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;
}
