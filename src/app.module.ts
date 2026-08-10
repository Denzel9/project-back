import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
