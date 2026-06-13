import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PostsModule } from '../posts/posts.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AuthModule, PostsModule],
  controllers: [MediaController],
  providers: [StorageService, MediaService],
  exports: [MediaService, StorageService],
})
export class MediaModule {}
