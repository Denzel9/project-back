import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplicationCreatorProfileDto {
  @ApiProperty({ example: 'John' })
  name: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;
}

export class ApplicationCompanyProfileDto {
  @ApiProperty({ example: 'Acme Inc.' })
  companyName: string;
}

export class ApplicationOwnerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar?: string;

  @ApiPropertyOptional({ type: ApplicationCreatorProfileDto })
  creatorProfile?: ApplicationCreatorProfileDto;

  @ApiPropertyOptional({ type: ApplicationCompanyProfileDto })
  companyProfile?: ApplicationCompanyProfileDto;
}
