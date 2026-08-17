import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FileTemplate, TaskMediaKind } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { ChatService } from '../chat/chat.service';
import {
  isAllowedDocumentMime,
  isAllowedImageMime,
  isAllowedVideoMime,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MIME_TO_EXTENSION,
  ALLOWED_UPLOAD_TYPES_LABEL,
  resolveUploadMime,
  sanitizeUploadFileName,
} from '../media/media.constants';
import { UploadResponseDto } from '../media/dto/upload-response.dto';
import { StorageService } from '../media/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { FileTemplateResponseDto } from './dto/file-template-response.dto';
import { SendFileTemplateDto } from './dto/send-file-template.dto';

@Injectable()
export class FileTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly chatService: ChatService,
    private readonly tasksService: TasksService
  ) {}

  async list(user: AuthUser): Promise<FileTemplateResponseDto[]> {
    const items = await this.prisma.fileTemplate.findMany({
      where: { ownerId: user.userId },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map(item => this.toResponse(item));
  }

  async create(
    user: AuthUser,
    file: Express.Multer.File,
    fileName?: string
  ): Promise<FileTemplateResponseDto> {
    const mimeType = resolveUploadMime(file.mimetype, file.originalname);
    const isImage = isAllowedImageMime(mimeType);
    const isVideo = isAllowedVideoMime(mimeType);
    const isDocument = isAllowedDocumentMime(mimeType);

    if (!isImage && !isVideo && !isDocument) {
      throw new BadRequestException(
        `Недопустимый тип файла. Разрешены: ${ALLOWED_UPLOAD_TYPES_LABEL}`
      );
    }

    const maxSize = isImage
      ? MAX_IMAGE_SIZE_BYTES
      : isVideo
        ? MAX_VIDEO_SIZE_BYTES
        : MAX_DOCUMENT_SIZE_BYTES;

    if (file.size > maxSize) {
      const limitMb = isImage ? 10 : isVideo ? 100 : 25;
      throw new BadRequestException(
        `Превышен максимальный размер файла (${limitMb} МБ)`
      );
    }

    const extension = MIME_TO_EXTENSION[mimeType] ?? 'bin';
    const key = `file-templates/${user.userId}/${randomUUID()}.${extension}`;

    try {
      await this.storageService.putObject(key, file.buffer, mimeType);
    } catch {
      throw new InternalServerErrorException('Не удалось загрузить файл');
    }

    const name =
      sanitizeUploadFileName(fileName) ??
      sanitizeUploadFileName(file.originalname) ??
      'Файл';

    const item = await this.prisma.fileTemplate.create({
      data: {
        ownerId: user.userId,
        name,
        url: this.storageService.getPublicUrl(key),
        key,
        size: String(file.size),
        mimeType,
      },
    });

    return this.toResponse(item);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const item = await this.findOwned(user.userId, id);

    try {
      await this.storageService.deleteObject(item.key);
    } catch {
      throw new InternalServerErrorException('Не удалось удалить файл');
    }

    await this.prisma.fileTemplate.delete({ where: { id } });
  }

  async send(
    user: AuthUser,
    id: string,
    dto: SendFileTemplateDto
  ): Promise<UploadResponseDto> {
    const conversationId = dto.conversationId?.trim();
    const taskId = dto.taskId?.trim();

    if (Boolean(conversationId) === Boolean(taskId)) {
      throw new BadRequestException('Укажите conversationId или taskId');
    }

    const item = await this.findOwned(user.userId, id);

    if (!item.key.startsWith(`file-templates/${user.userId}/`)) {
      throw new BadRequestException('Недопустимый ключ файла');
    }

    if (conversationId) {
      return this.copyToConversation(user.userId, item, conversationId);
    }

    return this.copyToTask(user, item, taskId!);
  }

  private async copyToConversation(
    userId: string,
    item: FileTemplate,
    conversationId: string
  ): Promise<UploadResponseDto> {
    await this.chatService.assertParticipant(conversationId, userId);

    const destKey = this.buildDestKey(
      `chats/${conversationId}`,
      item.mimeType,
      item.key
    );

    await this.copyObject(item.key, destKey, item.mimeType);

    return this.toUploadResponse(item, destKey);
  }

  private async copyToTask(
    user: AuthUser,
    item: FileTemplate,
    taskId: string
  ): Promise<UploadResponseDto> {
    await this.tasksService.assertParticipantForMedia(user.userId, taskId);

    const destKey = this.buildDestKey(
      `tasks/${taskId}/main`,
      item.mimeType,
      item.key
    );

    await this.copyObject(item.key, destKey, item.mimeType);

    const copied = this.toUploadResponse(item, destKey);

    await this.tasksService.addMedia(
      taskId,
      user.userId,
      {
        url: copied.url,
        key: copied.key,
        size: String(copied.size),
        mimeType: copied.mimeType,
        fileName: copied.fileName,
      },
      TaskMediaKind.MAIN,
      user.accountId
    );

    return copied;
  }

  private buildDestKey(prefix: string, mimeType: string, sourceKey: string) {
    const extension =
      MIME_TO_EXTENSION[mimeType] ??
      sourceKey.split('.').pop()?.toLowerCase() ??
      'bin';

    return `${prefix}/${randomUUID()}.${extension}`;
  }

  private async copyObject(
    sourceKey: string,
    destKey: string,
    mimeType: string
  ) {
    try {
      await this.storageService.copyObject(sourceKey, destKey, mimeType);
    } catch {
      throw new InternalServerErrorException('Не удалось скопировать файл');
    }
  }

  private toUploadResponse(
    item: FileTemplate,
    destKey: string
  ): UploadResponseDto {
    const size = Number(item.size);

    return {
      url: this.storageService.getPublicUrl(destKey),
      key: destKey,
      mimeType: item.mimeType,
      size: Number.isFinite(size) ? size : 0,
      fileName: sanitizeUploadFileName(item.name),
    };
  }

  private async findOwned(ownerId: string, id: string) {
    const item = await this.prisma.fileTemplate.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Файл не найден');
    }

    if (item.ownerId !== ownerId) {
      throw new ForbiddenException('Нет доступа к файлу');
    }

    return item;
  }

  private toResponse(item: FileTemplate): FileTemplateResponseDto {
    return {
      id: item.id,
      ownerId: item.ownerId,
      name: item.name,
      url: item.url,
      key: item.key,
      size: item.size,
      mimeType: item.mimeType,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
