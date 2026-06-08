import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const userWithProfileInclude = {
  creatorProfile: true,
  companyProfile: true,
} as const;

export type ProfileSummary = {
  userId: string;
  role: Role;
  email: string;
  displayName: string;
  avatar: string | null;
  membershipRole: MembershipRole;
  membershipId: string;
};

@Injectable()
export class AccountMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async listProfiles(
    accountId: string,
    activeUserId?: string
  ): Promise<Array<ProfileSummary & { isActive: boolean }>> {
    const memberships = await this.prisma.accountMembership.findMany({
      where: { accountId },
      include: {
        user: {
          include: userWithProfileInclude,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map(membership => ({
      id: membership.id,
      userId: membership.userId,
      role: membership.user.role,
      email: membership.user.email,
      displayName: this.getDisplayName(membership.user),
      avatar: membership.user.avatar,
      membershipRole: membership.role,
      membershipId: membership.id,
      isActive: membership.userId === activeUserId,
    }));
  }

  async getMembership(accountId: string, userId: string) {
    return this.prisma.accountMembership.findUnique({
      where: {
        accountId_userId: {
          accountId,
          userId,
        },
      },
    });
  }

  async assertMembership(accountId: string, userId: string) {
    const membership = await this.getMembership(accountId, userId);

    if (!membership) {
      throw new ForbiddenException('Нет доступа к этому профилю');
    }

    return membership;
  }

  async assertCanWrite(accountId: string, userId: string) {
    const membership = await this.assertMembership(accountId, userId);

    if (
      membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.ADMIN &&
      membership.role !== MembershipRole.EDITOR
    ) {
      throw new ForbiddenException('Недостаточно прав для изменения');
    }

    return membership;
  }

  async assertCanInvite(accountId: string, userId: string) {
    const membership = await this.assertMembership(accountId, userId);

    if (
      membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException('Недостаточно прав для приглашения');
    }

    return membership;
  }

  async assertCanManageMembers(accountId: string, userId: string) {
    const membership = await this.assertMembership(accountId, userId);

    if (
      membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException('Недостаточно прав для управления доступом');
    }

    return membership;
  }

  createOwnerMembership(accountId: string, userId: string) {
    return this.prisma.accountMembership.create({
      data: {
        accountId,
        userId,
        role: MembershipRole.OWNER,
      },
    });
  }

  createMembership(accountId: string, userId: string, role: MembershipRole) {
    if (role === MembershipRole.OWNER) {
      throw new BadRequestException(
        'Роль владельца можно назначить только при создании профиля'
      );
    }

    return this.prisma.accountMembership.create({
      data: {
        accountId,
        userId,
        role,
      },
    });
  }

  async getDefaultProfile(accountId: string) {
    const membership = await this.prisma.accountMembership.findFirst({
      where: { accountId },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      throw new NotFoundException('У аккаунта нет профилей');
    }

    return membership;
  }

  async revokeMembership(membershipId: string, actorAccountId: string) {
    const membership = await this.prisma.accountMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Запись о доступе не найдена');
    }

    await this.assertCanManageMembers(actorAccountId, membership.userId);

    if (membership.role === MembershipRole.OWNER) {
      throw new BadRequestException('Нельзя отозвать доступ владельца');
    }

    await this.prisma.accountMembership.delete({
      where: { id: membershipId },
    });
  }

  private getDisplayName(user: {
    role: Role;
    creatorProfile: { name: string; lastName: string } | null;
    companyProfile: { companyName: string } | null;
  }): string {
    if (user.role === Role.CREATOR && user.creatorProfile) {
      return `${user.creatorProfile.name} ${user.creatorProfile.lastName}`;
    }

    if (user.role === Role.COMPANY && user.companyProfile) {
      return user.companyProfile.companyName;
    }

    return user.role;
  }
}
