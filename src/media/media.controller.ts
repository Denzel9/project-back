import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipWriteGuard } from '../auth/guards/membership-write.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { TaskMediaKind } from '@prisma/client';
import { UploadResponseDto } from './dto/upload-response.dto';
import {
  isAllowedDocumentMime,
  isAllowedImageMime,
  isAllowedVideoMime,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
} from './media.constants';
import { MediaService } from './media.service';

export enum TaskMediaKindParam {
  MAIN = 'main',
  REPORT = 'report',
}

const TASK_MEDIA_KIND_MAP: Record<TaskMediaKindParam, TaskMediaKind> = {
  [TaskMediaKindParam.MAIN]: TaskMediaKind.MAIN,
  [TaskMediaKindParam.REPORT]: TaskMediaKind.REPORT,
};

@ApiTags('media')
@ApiCookieAuth('access-token')
@Controller('media')
@UseGuards(JwtAuthGuard, MembershipWriteGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Загрузить файл',
    description:
      'Без query — для профиля (`PATCH /users/update`). ' +
      'С `postId` — для поста. С `conversationId` — для чата (затем `send_message` с media[]). ' +
      'С `taskId` — для задачи (media задачи). `kind=report` — вложение отчёта (не смешивается с основными). `forComment=true` + `taskId` — для вложения в комментарий (без добавления в media задачи). ' +
      'Фото: JPEG, PNG, WebP, GIF до 10 МБ. Видео: MP4, WebM, MOV до 100 МБ. ' +
      'Документы (PDF, XLS, XLSX, DOC, DOCX до 25 МБ) — только с `taskId` или `conversationId`.',
  })
  @ApiQuery({
    name: 'postId',
    required: false,
    type: String,
    description:
      'UUID поста — файл сохранится в `posts/{postId}/...` и попадёт в media поста',
  })
  @ApiQuery({
    name: 'conversationId',
    required: false,
    type: String,
    description:
      'UUID диалога — файл в `chats/{conversationId}/...` для send_message',
  })
  @ApiQuery({
    name: 'taskId',
    required: false,
    type: String,
    description:
      'UUID задачи — `tasks/{taskId}/...`. С `forComment=true` — только для комментария',
  })
  @ApiQuery({
    name: 'forComment',
    required: false,
    type: Boolean,
    description:
      'С `taskId`: загрузка для комментария (ключ tasks/{taskId}/..., не попадает в media задачи)',
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: TaskMediaKindParam,
    description:
      'С `taskId` без forComment: main (по умолчанию) — основные вложения, report — отчёт исполнителя',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Файл: изображение, видео или документ (документ — только задача/чат)',
        },
      },
    },
  })
  @ApiCreatedResponse({
    type: UploadResponseDto,
    description: 'Файл загружен',
  })
  @ApiBadRequestResponse({
    description: 'Файл не передан, неверный тип или превышен размер',
  })
  @ApiForbiddenResponse({
    description:
      'Недостаточно прав (роль VIEWER, не владелец поста, не участник задачи или не участник диалога)',
  })
  @ApiNotFoundResponse({ description: 'Пост или задача не найдены' })
  async upload(
    @CurrentUser() user: AuthUser,
    @Query('postId') postId: string | undefined,
    @Query('conversationId') conversationId: string | undefined,
    @Query('taskId') taskId: string | undefined,
    @Query('forComment') forCommentRaw: string | undefined,
    @Query('kind') kindRaw: string | undefined,
    @UploadedFile() file?: Express.Multer.File
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const forComment = forCommentRaw === 'true';

    if (forComment && !taskId) {
      throw new BadRequestException(
        'forComment можно использовать только вместе с taskId'
      );
    }

    let taskMediaKind: TaskMediaKind | undefined;

    if (kindRaw !== undefined) {
      if (!taskId) {
        throw new BadRequestException('kind можно использовать только с taskId');
      }

      if (forComment) {
        throw new BadRequestException(
          'kind несовместим с forComment=true'
        );
      }

      if (
        kindRaw !== TaskMediaKindParam.MAIN &&
        kindRaw !== TaskMediaKindParam.REPORT
      ) {
        throw new BadRequestException(
          'kind должен быть main или report'
        );
      }

      taskMediaKind = TASK_MEDIA_KIND_MAP[kindRaw as TaskMediaKindParam];
    }

    const targetCount = [postId, conversationId, taskId].filter(Boolean).length;
    if (targetCount > 1) {
      throw new BadRequestException(
        'Укажите только один из: postId, conversationId, taskId'
      );
    }

    const isImage = isAllowedImageMime(file.mimetype);
    const isVideo = isAllowedVideoMime(file.mimetype);
    const isDocument = isAllowedDocumentMime(file.mimetype);

    if (!isImage && !isVideo && !isDocument) {
      throw new BadRequestException(
        'Недопустимый тип файла. Разрешены: JPEG, PNG, WebP, GIF, MP4, WebM, MOV, PDF, XLS, XLSX, DOC, DOCX'
      );
    }

    if (isDocument && !taskId && !conversationId) {
      throw new BadRequestException(
        'Документы можно загружать только в задачу или чат'
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

    return this.mediaService.upload(user.userId, file, {
      ...(postId && { postId }),
      ...(conversationId && { conversationId }),
      ...(taskId && { taskId }),
      ...(forComment && { forComment: true }),
      ...(taskMediaKind && { taskMediaKind }),
    });
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить медиа',
    description:
      'С `postId` — из поста (только owner). ' +
      'С `taskId` — из задачи (owner или executor). ' +
      'С `conversationId` — из чата (только отправитель сообщения). ' +
      'Удаляет запись в БД и файл в S3.',
  })
  @ApiQuery({
    name: 'postId',
    required: false,
    type: String,
    description: 'UUID поста',
  })
  @ApiQuery({
    name: 'conversationId',
    required: false,
    type: String,
    description: 'UUID диалога',
  })
  @ApiQuery({
    name: 'taskId',
    required: false,
    type: String,
    description: 'UUID задачи',
  })
  @ApiNoContentResponse({ description: 'Медиа удалено' })
  @ApiBadRequestResponse({
    description: 'Не указан контекст или указано несколько параметров',
  })
  @ApiForbiddenResponse({
    description: 'Недостаточно прав',
  })
  @ApiNotFoundResponse({
    description: 'Медиа, пост, задача или диалог не найдены',
  })
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Query('postId') postId: string | undefined,
    @Query('conversationId') conversationId: string | undefined,
    @Query('taskId') taskId: string | undefined
  ): Promise<void> {
    const targetCount = [postId, conversationId, taskId].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException(
        'Укажите ровно один из: postId, conversationId, taskId'
      );
    }

    await this.mediaService.delete(user.userId, mediaId, {
      ...(postId && { postId }),
      ...(conversationId && { conversationId }),
      ...(taskId && { taskId }),
    });
  }
}
