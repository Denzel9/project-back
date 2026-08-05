import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../auth.types';
import { assertMarketplaceParticipant } from '../utils/marketplace-participant.util';

@Injectable()
export class MarketplaceParticipantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: AuthUser }>();
    assertMarketplaceParticipant(user.role);
    return true;
  }
}
