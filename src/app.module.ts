import { BullModule } from '@nestjs/bullmq';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { CompanyModule } from './company/company.module';
import { CreatorModule } from './creator/creator.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { MediaModule } from './media/media.module';
import { PostsModule } from './posts/posts.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ApplicationsModule } from './applications/applications.module';
import { TasksModule } from './tasks/tasks.module';
import { PartnersModule } from './partners/partners.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PublicationsModule } from './publications/publications.module';
import { UserConfigModule } from './user-config/user-config.module';
import { GeoModule } from './geo/geo.module';
import { BillingModule } from './billing/billing.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { RedisModule } from './redis/redis.module';
import { TaskTemplatesModule } from './task-templates/task-templates.module';
import { FileTemplatesModule } from './file-templates/file-templates.module';
import { getBullMqConnection, getRedisUrl } from './redis/redis-connection';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: getBullMqConnection(configService),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          { name: 'auth', ttl: seconds(60), limit: 10 },
          { name: 'upload', ttl: seconds(60), limit: 100 },
        ],
        storage: new ThrottlerStorageRedisService(getRedisUrl(configService)),
      }),
    }),
    RedisModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    ChatModule,
    CreatorModule,
    CompanyModule,
    MediaModule,
    PostsModule,
    FavoritesModule,
    ApplicationsModule,
    TasksModule,
    PartnersModule,
    NotificationsModule,
    PublicationsModule,
    UserConfigModule,
    GeoModule,
    BillingModule,
    IntegrationsModule,
    TaskTemplatesModule,
    FileTemplatesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    AppService,
  ],
})
export class AppModule {}
