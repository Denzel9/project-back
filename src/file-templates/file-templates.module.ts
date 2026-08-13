import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { StorageModule } from '../media/storage.module';
import { TasksModule } from '../tasks/tasks.module';
import { FileTemplatesController } from './file-templates.controller';
import { FileTemplatesService } from './file-templates.service';

@Module({
  imports: [AuthModule, StorageModule, ChatModule, TasksModule],
  controllers: [FileTemplatesController],
  providers: [FileTemplatesService],
})
export class FileTemplatesModule {}
