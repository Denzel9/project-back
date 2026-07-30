import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  imports: [AuthModule],
  controllers: [GeoController],
  providers: [GeoService],
})
export class GeoModule {}
