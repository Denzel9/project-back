import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { MessengerDeliveryService } from './messenger-delivery.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, MessengerDeliveryService],
  exports: [MessengerDeliveryService, IntegrationsService],
})
export class IntegrationsModule {}
