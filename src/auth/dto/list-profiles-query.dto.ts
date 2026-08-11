import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { ProfileListScope } from '../../accounts/account-membership.service';

export const PROFILE_LIST_SCOPES = ['all', 'companies', 'linked'] as const;

export class ListProfilesQueryDto {
  @ApiPropertyOptional({
    enum: PROFILE_LIST_SCOPES,
    description:
      'all — все доступные (switcher); companies — мультиаккаунт для MANAGER; linked — кросс-аккаунты',
  })
  @IsOptional()
  @IsIn(PROFILE_LIST_SCOPES)
  scope?: ProfileListScope;
}
