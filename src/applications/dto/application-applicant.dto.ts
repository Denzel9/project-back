import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class ApplicationApplicantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiPropertyOptional({ nullable: true })
  avatar: string | null;

  @ApiPropertyOptional({ example: 'John', description: 'Для CREATOR' })
  name?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Для CREATOR' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'Acme Inc.', description: 'Для COMPANY' })
  companyName?: string;
}
