import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
