import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { MIME_TO_EXTENSION } from './media.constants';
import { UploadResponseDto } from './dto/upload-response.dto';
import { StorageService } from './storage.service';

export type MediaUploadTarget = {
  postId?: string;
  conversationId?: string;
};

@Injectable()
export class MediaService {
  constructor(
    private readonly storageService: StorageService,
    private readonly postsService: PostsService,
    private readonly prisma: PrismaService
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File,
    target: MediaUploadTarget = {}
  ): Promise<UploadResponseDto> {
    const extension = MIME_TO_EXTENSION[file.mimetype];
    const { postId, conversationId } = target;

    let key: string;

    if (postId) {
      await this.postsService.assertOwnerForMedia(userId, postId);
      key = `posts/${postId}/${randomUUID()}.${extension}`;
    } else if (conversationId) {
      await this.assertConversationParticipant(userId, conversationId);
      key = `chats/${conversationId}/${randomUUID()}.${extension}`;
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
    }

    return {
      url,
      key,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async assertConversationParticipant(
    userId: string,
    conversationId: string
  ) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Нет доступа к этому диалогу');
    }
  }
}
