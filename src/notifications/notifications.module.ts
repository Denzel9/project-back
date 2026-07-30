import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ChatEmailThrottleService } from './chat-email-throttle.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [forwardRef(() => AuthModule), MailModule, UserConfigModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    ChatEmailThrottleService,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
