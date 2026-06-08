import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCompanyProfileDto {
    @ApiPropertyOptional({ example: 'Acme Inc.' })
    @IsOptional()
    @IsString()
    companyName?: string;
}
