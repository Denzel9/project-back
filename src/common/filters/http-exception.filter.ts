import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

const ERROR_STATUS_LABELS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Некорректный запрос',
  [HttpStatus.UNAUTHORIZED]: 'Не авторизован',
  [HttpStatus.FORBIDDEN]: 'Доступ запрещён',
  [HttpStatus.NOT_FOUND]: 'Не найдено',
  [HttpStatus.CONFLICT]: 'Конфликт',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Внутренняя ошибка сервера',
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const errorLabel =
      ERROR_STATUS_LABELS[status] ?? HttpStatus[status] ?? 'Ошибка';

    if (typeof exceptionResponse === 'string') {
      response.status(status).json({
        statusCode: status,
        message: exceptionResponse,
        error: errorLabel,
      });
      return;
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const body = exceptionResponse as Record<string, unknown>;
      const message = body.message;

      response.status(status).json({
        ...body,
        statusCode: status,
        message:
          message ??
          (status === HttpStatus.UNAUTHORIZED
            ? 'Не авторизован'
            : status === HttpStatus.FORBIDDEN
            ? 'Доступ запрещён'
            : 'Произошла ошибка'),
        error: errorLabel,
      });
      return;
    }

    response.status(status).json({
      statusCode: status,
      message: 'Произошла ошибка',
      error: errorLabel,
    });
  }
}
