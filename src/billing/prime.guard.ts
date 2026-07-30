import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { PrimeSubscriptionService } from './prime-subscription.service';

@Injectable()
export class PrimeGuard implements CanActivate {
  constructor(
    private readonly primeSubscriptionService: PrimeSubscriptionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user?.accountId) {
      return false;
    }

    await this.primeSubscriptionService.assertPrime(user.userId);
    return true;
  }
}
