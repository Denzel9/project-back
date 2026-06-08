import { Module } from '@nestjs/common';
import { AccountMembershipService } from './account-membership.service';
import { AccountsService } from './accounts.service';

@Module({
  providers: [AccountsService, AccountMembershipService],
  exports: [AccountsService, AccountMembershipService],
})
export class AccountsModule {}
