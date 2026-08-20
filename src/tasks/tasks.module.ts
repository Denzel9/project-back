import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PublicationsModule } from '../publications/publications.module';
import { StorageModule } from '../media/storage.module';
import { TaskCommentsGateway } from './task-comments.gateway';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    AccountsModule,
    AuthModule,
    BillingModule,
    ChatModule,
    NotificationsModule,
    PublicationsModule,
    StorageModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskCommentsGateway],
  exports: [TasksService, TaskCommentsGateway],
})
export class TasksModule {}
