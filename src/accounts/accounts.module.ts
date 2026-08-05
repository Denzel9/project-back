import { Module } from '@nestjs/common';
import { AccountMembershipService } from './account-membership.service';
import { AccountsService } from './accounts.service';
import { ActorAttributionService } from './actor-attribution.service';

@Module({
  providers: [
    AccountsService,
    AccountMembershipService,
    ActorAttributionService,
  ],
  exports: [
    AccountsService,
    AccountMembershipService,
    ActorAttributionService,
  ],
})
export class AccountsModule {}
