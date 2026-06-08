import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { AuthUser } from '../auth.types';

@Injectable()
export class MembershipWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: AuthUser }>();

    if (
      user.membershipRole === MembershipRole.OWNER ||
      user.membershipRole === MembershipRole.ADMIN ||
      user.membershipRole === MembershipRole.EDITOR
    ) {
      return true;
    }

    throw new ForbiddenException('Недостаточно прав для изменения');
  }
}
