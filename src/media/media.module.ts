import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { PostsModule } from '../posts/posts.module';
import { TasksModule } from '../tasks/tasks.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageModule } from './storage.module';

@Module({
  imports: [AuthModule, PostsModule, TasksModule, ChatModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService, StorageModule],
})
export class MediaModule {}
