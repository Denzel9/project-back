import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChatService } from '../chat/chat.service';
import { PostsService } from '../posts/posts.service';
import { TasksService } from '../tasks/tasks.service';
import { MIME_TO_EXTENSION } from './media.constants';
import { UploadResponseDto } from './dto/upload-response.dto';
import { StorageService } from './storage.service';

export type MediaUploadTarget = {
  postId?: string;
  conversationId?: string;
  taskId?: string;
  forComment?: boolean;
};

export type MediaDeleteTarget = {
  postId?: string;
  conversationId?: string;
  taskId?: string;
};

@Injectable()
export class MediaService {
  constructor(
    private readonly storageService: StorageService,
    private readonly postsService: PostsService,
    private readonly tasksService: TasksService,
    private readonly chatService: ChatService
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File,
    target: MediaUploadTarget = {}
  ): Promise<UploadResponseDto> {
    const extension = MIME_TO_EXTENSION[file.mimetype];
    const { postId, conversationId, taskId, forComment } = target;

    let key: string;

    if (postId) {
      await this.postsService.assertOwnerForMedia(userId, postId);
      key = `posts/${postId}/${randomUUID()}.${extension}`;
    } else if (conversationId) {
      await this.chatService.assertParticipant(conversationId, userId);
      key = `chats/${conversationId}/${randomUUID()}.${extension}`;
    } else if (taskId) {
      await this.tasksService.assertParticipantForMedia(userId, taskId);
      key = `tasks/${taskId}/${randomUUID()}.${extension}`;
    } else {
      key = `${userId}/${randomUUID()}.${extension}`;
    }

    try {
      await this.storageService.putObject(key, file.buffer, file.mimetype);
    } catch {
      throw new InternalServerErrorException('Не удалось загрузить файл');
    }

    const url = this.storageService.getPublicUrl(key);

    if (postId) {
      await this.postsService.addMedia(postId, {
        url,
        key,
        size: String(file.size),
        mimeType: file.mimetype,
      });
    } else if (taskId && !forComment) {
      await this.tasksService.addMedia(taskId, userId, {
        url,
        key,
        size: String(file.size),
        mimeType: file.mimetype,
      });
    }

    return {
      url,
      key,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async delete(
    userId: string,
    mediaId: string,
    target: MediaDeleteTarget
  ): Promise<void> {
    const { postId, conversationId, taskId } = target;

    if (postId) {
      await this.postsService.removeMedia(userId, postId, mediaId);
      return;
    }

    if (taskId) {
      await this.tasksService.removeMedia(userId, taskId, mediaId);
      return;
    }

    if (conversationId) {
      await this.chatService.removeAttachment(userId, conversationId, mediaId);
      return;
    }

    throw new BadRequestException('Укажите postId, taskId или conversationId');
  }
}
