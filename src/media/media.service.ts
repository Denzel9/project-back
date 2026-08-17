import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TaskMediaKind } from '@prisma/client';
import { ChatService } from '../chat/chat.service';
import { PostsService } from '../posts/posts.service';
import { TasksService } from '../tasks/tasks.service';
import { MIME_TO_EXTENSION, resolveUploadMime, sanitizeUploadFileName } from './media.constants';
import { CopyTaskMediaKindDto } from './dto/copy-task-media-to-conversation.dto';
import { UploadResponseDto } from './dto/upload-response.dto';
import { StorageService } from './storage.service';

export type MediaUploadTarget = {
  postId?: string;
  conversationId?: string;
  taskId?: string;
  forComment?: boolean;
  taskMediaKind?: TaskMediaKind;
  /** Client-provided original name (preferred over multer originalname) */
  fileName?: string | null;
  /** Canonical MIME after alias/extension resolution */
  mimeType?: string;
};

export type MediaDeleteTarget = {
  postId?: string;
  conversationId?: string;
  taskId?: string;
};

const COPY_KIND_MAP: Record<CopyTaskMediaKindDto, TaskMediaKind> = {
  [CopyTaskMediaKindDto.MAIN]: TaskMediaKind.MAIN,
  [CopyTaskMediaKindDto.REPORT]: TaskMediaKind.REPORT,
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
    target: MediaUploadTarget = {},
    accountId?: string
  ): Promise<UploadResponseDto> {
    const mimeType =
      target.mimeType ||
      resolveUploadMime(file.mimetype, file.originalname);
    const extension = MIME_TO_EXTENSION[mimeType];
    const { postId, conversationId, taskId, forComment, taskMediaKind } =
      target;

    let key: string;

    if (postId) {
      await this.postsService.assertOwnerForMedia(userId, postId);
      key = `posts/${postId}/${randomUUID()}.${extension}`;
    } else if (conversationId) {
      await this.chatService.assertParticipant(conversationId, userId);
      key = `chats/${conversationId}/${randomUUID()}.${extension}`;
    } else if (taskId) {
      await this.tasksService.assertParticipantForMedia(userId, taskId);
      if (forComment) {
        key = `tasks/${taskId}/${randomUUID()}.${extension}`;
      } else {
        const subPath =
          taskMediaKind === TaskMediaKind.REPORT ? 'reports' : 'main';
        key = `tasks/${taskId}/${subPath}/${randomUUID()}.${extension}`;
      }
    } else {
      key = `${userId}/${randomUUID()}.${extension}`;
    }

    try {
      await this.storageService.putObject(key, file.buffer, mimeType);
    } catch {
      throw new InternalServerErrorException('Не удалось загрузить файл');
    }

    const url = this.storageService.getPublicUrl(key);
    const fileName =
      sanitizeUploadFileName(target.fileName) ??
      sanitizeUploadFileName(file.originalname);

    if (postId) {
      await this.postsService.addMedia(postId, {
        url,
        key,
        size: String(file.size),
        mimeType,
      });
    } else if (taskId && !forComment) {
      await this.tasksService.addMedia(
        taskId,
        userId,
        {
          url,
          key,
          size: String(file.size),
          mimeType,
          fileName,
        },
        taskMediaKind ?? TaskMediaKind.MAIN,
        accountId
      );
    }

    return {
      url,
      key,
      mimeType,
      size: file.size,
      fileName,
    };
  }

  async copyTaskMediaToConversation(
    userId: string,
    params: {
      taskId: string;
      conversationId: string;
      kind?: CopyTaskMediaKindDto;
      mediaIds?: string[];
    }
  ): Promise<UploadResponseDto[]> {
    const { taskId, conversationId, mediaIds } = params;
    const kind = COPY_KIND_MAP[params.kind ?? CopyTaskMediaKindDto.MAIN];

    await this.chatService.assertParticipant(conversationId, userId);

    const items = await this.tasksService.listMediaForCopy(userId, taskId, {
      kind,
      mediaIds,
    });

    if (!items.length) {
      return [];
    }

    const results: UploadResponseDto[] = [];

    for (const item of items) {
      if (!item.key.startsWith(`tasks/${taskId}/`)) {
        throw new BadRequestException('Недопустимый ключ медиа задачи');
      }

      const extension =
        MIME_TO_EXTENSION[item.mimeType] ??
        item.key.split('.').pop()?.toLowerCase() ??
        'bin';
      const destKey = `chats/${conversationId}/${randomUUID()}.${extension}`;

      try {
        await this.storageService.copyObject(
          item.key,
          destKey,
          item.mimeType
        );
      } catch {
        throw new InternalServerErrorException(
          'Не удалось скопировать медиа в диалог'
        );
      }

      const size = Number(item.size);

      results.push({
        url: this.storageService.getPublicUrl(destKey),
        key: destKey,
        mimeType: item.mimeType,
        size: Number.isFinite(size) ? size : 0,
        fileName: item.fileName ?? null,
      });
    }

    return results;
  }

  async delete(
    userId: string,
    mediaId: string,
    target: MediaDeleteTarget,
    accountId?: string
  ): Promise<void> {
    const { postId, conversationId, taskId } = target;

    if (postId) {
      await this.postsService.removeMedia(userId, postId, mediaId);
      return;
    }

    if (taskId) {
      await this.tasksService.removeMedia(userId, taskId, mediaId, accountId);
      return;
    }

    if (conversationId) {
      await this.chatService.removeAttachment(userId, conversationId, mediaId);
      return;
    }

    throw new BadRequestException('Укажите postId, taskId или conversationId');
  }
}
