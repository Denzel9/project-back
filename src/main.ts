import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { formatValidationErrors } from './common/validation/format-validation-errors';
import { buildSwaggerDocument } from './swagger/swagger-document';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: errors =>
        new BadRequestException(formatValidationErrors(errors)),
    })
  );

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });

  const document = buildSwaggerDocument(app);

  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3010);
}
bootstrap();
