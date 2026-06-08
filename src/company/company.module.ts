import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompanyController } from './company.controller';

@Module({
  imports: [AuthModule],
  controllers: [CompanyController],
})
export class CompanyModule {}
