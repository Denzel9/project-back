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
  actorName: string | null;
  avatar: string | null;
  membershipRole: MembershipRole;
  membershipId: string;
  isVerified: boolean;
  isEmailConfirmed: boolean;
  createdAt: string;
};

@Injectable()
export class AccountMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async listProfiles(
    accountId: string,
    activeUserId?: string
  ): Promise<Array<ProfileSummary & { isActive: boolean; id: string }>> {
    const memberships = await this.prisma.accountMembership.findMany({
      where: { accountId },
      include: {
        user: {
          include: userWithProfileInclude,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const managerUser = memberships.find(
      membership => membership.user.role === Role.MANAGER
    )?.user;
    const managerActorName = managerUser
      ? this.getManagerDisplayName(managerUser)
      : null;

    return memberships.map(membership => {
      const isManaged =
        membership.user.role === Role.COMPANY ||
        membership.user.role === Role.CREATOR;

      return {
        id: membership.id,
        userId: membership.userId,
        role: membership.user.role,
        email: membership.user.email,
        displayName: this.getDisplayName(membership.user),
        actorName: isManaged ? managerActorName : null,
        avatar: membership.user.avatar,
        membershipRole: membership.role,
        membershipId: membership.id,
        isActive: membership.userId === activeUserId,
        isVerified: membership.user.isVerified,
        isEmailConfirmed: membership.user.isEmailConfirmed,
        createdAt: membership.createdAt.toISOString(),
      };
    });
  }

  /**
   * Участники текущего профиля (аккаунты с membership на userId).
   * Менеджеры — ADMIN; владелец — OWNER.
   */
  async listProfileMembers(actorAccountId: string, profileUserId: string) {
    await this.assertCanManageMembers(actorAccountId, profileUserId);

    const memberships = await this.prisma.accountMembership.findMany({
      where: { userId: profileUserId },
      include: {
        account: {
          include: {
            memberships: {
              include: {
                user: {
                  include: userWithProfileInclude,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map(membership => {
      const managerUser = membership.account.memberships.find(
        item => item.user.role === Role.MANAGER
      )?.user;
      const profileUser = membership.account.memberships.find(
        item => item.userId === profileUserId
      )?.user;

      const displayName = managerUser
        ? this.getManagerDisplayName(managerUser)
        : profileUser
          ? this.getDisplayName(profileUser)
          : (membership.account.email ?? 'Участник');

      return {
        accountId: membership.accountId,
        membershipId: membership.id,
        membershipRole: membership.role,
        email: membership.account.email,
        displayName,
      };
    });
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role === Role.MANAGER) {
      throw new ForbiddenException(
        'Профиль менеджера неактивен. Дождитесь приглашения к управлению компанией или профилем.'
      );
    }

    if (
      membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException('Недостаточно прав для изменения');
    }

    return membership;
  }

  /**
   * Чат (включая «Заметки» и ответы во входящих диалогах) доступен
   * и профилю MANAGER на собственном аккаунте.
   */
  async assertCanChat(accountId: string, userId: string) {
    const membership = await this.assertMembership(accountId, userId);

    if (
      membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.ADMIN
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
      include: {
        user: {
          include: userWithProfileInclude,
        },
      },
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

    return membership;
  }

  private getDisplayName(user: {
    role: Role;
    email?: string;
    person?: unknown;
    creatorProfile: { name: string; lastName: string } | null;
    companyProfile: { companyName: string } | null;
  }): string {
    if (user.role === Role.CREATOR && user.creatorProfile) {
      return `${user.creatorProfile.name} ${user.creatorProfile.lastName}`;
    }

    if (user.role === Role.COMPANY && user.companyProfile) {
      return user.companyProfile.companyName;
    }

    if (user.role === Role.MANAGER) {
      return this.getManagerDisplayName(user);
    }

    return user.role;
  }

  private getManagerDisplayName(user: {
    email?: string;
    person?: unknown;
  }): string {
    const fromPerson = this.getPersonFullName(user.person);
    if (fromPerson) return fromPerson;
    return user.email ?? 'Менеджер';
  }

  private getPersonFullName(person: unknown): string | null {
    if (!person || typeof person !== 'object' || Array.isArray(person)) {
      return null;
    }

    const record = person as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const lastName =
      typeof record.lastName === 'string' ? record.lastName.trim() : '';
    const fullName = `${name} ${lastName}`.trim();

    return fullName || null;
  }
}
