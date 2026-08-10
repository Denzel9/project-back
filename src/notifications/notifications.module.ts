import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { UserConfigModule } from '../user-config/user-config.module';
import { ChatEmailThrottleService } from './chat-email-throttle.service';
import { DeadlineReminderService } from './deadline-reminder.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MailModule,
    UserConfigModule,
    IntegrationsModule,
    forwardRef(() => PushModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    ChatEmailThrottleService,
    DeadlineReminderService,
  ],
  exports: [NotificationsService, NotificationsGateway, DeadlineReminderService],
})
export class NotificationsModule {}
