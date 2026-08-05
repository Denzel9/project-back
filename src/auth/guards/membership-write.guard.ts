import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { AuthUser } from '../auth.types';
import { assertMarketplaceParticipant } from '../utils/marketplace-participant.util';

@Injectable()
export class MembershipWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: AuthUser }>();

    assertMarketplaceParticipant(user.role);

    if (
      user.membershipRole === MembershipRole.OWNER ||
      user.membershipRole === MembershipRole.ADMIN
    ) {
      return true;
    }

    throw new ForbiddenException('Недостаточно прав для изменения');
  }
}
