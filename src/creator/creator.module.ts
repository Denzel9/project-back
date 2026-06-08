import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CreatorController } from './creator.controller';

@Module({
  imports: [AuthModule],
  controllers: [CreatorController],
})
export class CreatorModule {}
