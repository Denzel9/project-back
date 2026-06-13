import {
  BadRequestException,
  Controller,
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
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipWriteGuard } from '../auth/guards/membership-write.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { UploadResponseDto } from './dto/upload-response.dto';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_MEDIA_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
} from './media.constants';
import { MediaService } from './media.service';

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
    summary: 'Загрузить фото или видео',
    description:
      'Без query — для профиля (`PATCH /users/update`). ' +
      'С `postId` — для поста. С `conversationId` — для чата (затем `send_message` с media[]). ' +
      'Фото: JPEG, PNG, WebP, GIF до 10 МБ. Видео: MP4, WebM, MOV до 100 МБ.',
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
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Файл изображения или видео',
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
      'Недостаточно прав (роль VIEWER, не владелец поста или не участник диалога)',
  })
  @ApiNotFoundResponse({ description: 'Пост не найден' })
  async upload(
    @CurrentUser() user: AuthUser,
    @Query('postId') postId: string | undefined,
    @Query('conversationId') conversationId: string | undefined,
    @UploadedFile() file?: Express.Multer.File
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    if (postId && conversationId) {
      throw new BadRequestException(
        'Нельзя одновременно указать postId и conversationId'
      );
    }

    if (
      !(ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(file.mimetype)
    ) {
      throw new BadRequestException(
        'Недопустимый тип файла. Разрешены: JPEG, PNG, WebP, GIF, MP4, WebM, MOV'
      );
    }

    const isImage = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(
      file.mimetype
    );
    const maxSize = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;

    if (file.size > maxSize) {
      const limitMb = isImage ? 10 : 100;
      throw new BadRequestException(
        `Превышен максимальный размер файла (${limitMb} МБ)`
      );
    }

    const isVideo = (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(
      file.mimetype
    );
    if (!isImage && !isVideo) {
      throw new BadRequestException('Недопустимый тип файла');
    }

    return this.mediaService.upload(user.userId, file, {
      ...(postId && { postId }),
      ...(conversationId && { conversationId }),
    });
  }
}
