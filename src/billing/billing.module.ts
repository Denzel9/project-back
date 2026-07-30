import { Module, forwardRef } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { PrimeGuard } from './prime.guard';
import { PrimeSubscriptionService } from './prime-subscription.service';

@Module({
  imports: [AccountsModule, forwardRef(() => AuthModule)],
  controllers: [BillingController],
  providers: [PrimeSubscriptionService, PrimeGuard],
  exports: [PrimeSubscriptionService, PrimeGuard],
})
export class BillingModule {}
