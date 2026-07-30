import { Prisma, Role } from '@prisma/client';
import { PartnerSummaryDto } from './dto/partner-summary.dto';

const partnerUserInclude = {
  creatorProfile: true,
  companyProfile: true,
  _count: {
    select: {
      ownedPublications: true,
      executedPublications: true,
    },
  },
} satisfies Prisma.UserInclude;

export type PartnerUser = Prisma.UserGetPayload<{
  include: typeof partnerUserInclude;
}>;

export { partnerUserInclude };

export function mapPartnerSummary(
  user: PartnerUser,
  stats: { interactionsCount: number; lastInteractionAt: Date }
): PartnerSummaryDto {
  const base: PartnerSummaryDto = {
    id: user.id,
    role: user.role,
    avatar: user.avatar,
    isVerified: user.isVerified,
    publicationsCount:
      user._count.ownedPublications + user._count.executedPublications,
    interactionsCount: stats.interactionsCount,
    lastInteractionAt: stats.lastInteractionAt.toISOString(),
  };

  if (user.role === Role.CREATOR && user.creatorProfile) {
    return {
      ...base,
      name: user.creatorProfile.name,
      lastName: user.creatorProfile.lastName,
    };
  }

  if (user.role === Role.COMPANY && user.companyProfile) {
    return {
      ...base,
      companyName: user.companyProfile.companyName,
    };
  }

  return base;
}

export function creatorNameOrderBy(): Prisma.UserOrderByWithRelationInput[] {
  return [
    { creatorProfile: { name: 'asc' } },
    { creatorProfile: { lastName: 'asc' } },
  ];
}

export function companyNameOrderBy(): Prisma.UserOrderByWithRelationInput[] {
  return [{ companyProfile: { companyName: 'asc' } }];
}
