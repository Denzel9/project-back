// Import first so Sentry can instrument Nest modules.
import './instrument';

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { buildCorsOptions } from './common/cors';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { formatValidationErrors } from './common/validation/format-validation-errors';
import { getRedisUrl } from './redis/redis-connection';
import { buildSwaggerDocument } from './swagger/swagger-document';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  const redisIoAdapter = new RedisIoAdapter(app, getRedisUrl(configService));
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/assets',
  });

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
  app.enableCors(buildCorsOptions());

  const document = buildSwaggerDocument(app);

  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3010, '0.0.0.0');
}
bootstrap();
