import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { EmailConfirmedGuard } from '../auth/guards/email-confirmed.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MembershipWriteGuard } from '../auth/guards/membership-write.guard';
import { ThrottleUpload } from '../common/decorators/throttle.decorator';
import { UploadResponseDto } from '../media/dto/upload-response.dto';
import { FileTemplateResponseDto } from './dto/file-template-response.dto';
import { SendFileTemplateDto } from './dto/send-file-template.dto';
import { FileTemplatesService } from './file-templates.service';

@ApiTags('file-templates')
@ApiCookieAuth('access-token')
@Controller('file-templates')
@UseGuards(JwtAuthGuard)
export class FileTemplatesController {
  constructor(private readonly fileTemplatesService: FileTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Список файловых шаблонов текущего профиля' })
  @ApiOkResponse({ type: FileTemplateResponseDto, isArray: true })
  list(@CurrentUser() user: AuthUser) {
    return this.fileTemplatesService.list(user);
  }

  @Post()
  @ThrottleUpload()
  @UseGuards(EmailConfirmedGuard, MembershipWriteGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Загрузить файл как шаблон' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        fileName: { type: 'string' },
      },
    },
  })
  @ApiCreatedResponse({ type: FileTemplateResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body('fileName') fileName: string | undefined,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    return this.fileTemplatesService.create(user, file, fileName);
  }

  @Post(':id/send')
  @UseGuards(EmailConfirmedGuard, MembershipWriteGuard)
  @ApiOperation({
    summary: 'Отправить файловый шаблон в чат или задачу',
    description:
      'Копирует объект S3 из `file-templates/...` в `chats/{conversationId}/...` или `tasks/{taskId}/main/...`. ' +
      'Для чата результат нужно передать в `send_message.media[]`. Для задачи файл сразу добавляется во вложения.',
  })
  @ApiBody({ type: SendFileTemplateDto })
  @ApiCreatedResponse({ type: UploadResponseDto })
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendFileTemplateDto
  ) {
    return this.fileTemplatesService.send(user, id, body);
  }

  @Delete(':id')
  @UseGuards(EmailConfirmedGuard, MembershipWriteGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить файловый шаблон' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.fileTemplatesService.remove(user, id);
  }
}
