import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth.types';

@Injectable()
export class EmailConfirmedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<{ user: AuthUser }>();

    if (!user?.userId) {
      throw new ForbiddenException(
        'Подтвердите почту, чтобы получить полный доступ'
      );
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { isEmailConfirmed: true },
    });

    if (!dbUser?.isEmailConfirmed) {
      throw new ForbiddenException(
        'Подтвердите почту, чтобы получить полный доступ'
      );
    }

    return true;
  }
}
