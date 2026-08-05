import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { AuthUser } from '../auth.types';

/** OWNER/ADMIN membership only — allows MANAGER shell account settings. */
@Injectable()
export class MembershipRoleWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: AuthUser }>();

    if (
      user.membershipRole === MembershipRole.OWNER ||
      user.membershipRole === MembershipRole.ADMIN
    ) {
      return true;
    }

    throw new ForbiddenException('Недостаточно прав для изменения');
  }
}
