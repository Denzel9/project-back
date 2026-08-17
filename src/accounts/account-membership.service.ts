import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ProfileListScope = 'all' | 'companies' | 'linked';

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
  /** companies = мультиаккаунт; linked = кросс */
  linkKind: 'own' | 'companies' | 'linked';
  /** false для исходящих кросс-связей (партнёр виден, но switch недоступен) */
  canSwitch: boolean;
};

@Injectable()
export class AccountMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Роль владельца аккаунта (OWNER membership → user.role).
   * Определяет тип аккаунта: MANAGER / COMPANY / CREATOR.
   */
  async getAccountOwnerUserRole(accountId: string): Promise<Role | null> {
    const ownerMembership = await this.prisma.accountMembership.findFirst({
      where: { accountId, role: MembershipRole.OWNER },
      include: { user: { select: { role: true } } },
    });
    return ownerMembership?.user.role ?? null;
  }

  async listProfiles(
    accountId: string,
    activeUserId?: string,
    scope: ProfileListScope = 'all'
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

    const actorRole = await this.getAccountOwnerUserRole(accountId);
    const managerUser = memberships.find(
      membership => membership.user.role === Role.MANAGER
    )?.user;
    const managerActorName = managerUser
      ? this.getManagerDisplayName(managerUser)
      : null;

    const mapped = memberships.map(membership => {
      const isOwn = membership.role === MembershipRole.OWNER;
      const isManagedProfile =
        membership.user.role === Role.COMPANY ||
        membership.user.role === Role.CREATOR;

      let linkKind: ProfileSummary['linkKind'] = 'own';
      if (!isOwn && isManagedProfile) {
        // Мультиаккаунт: менеджер управляет COMPANY/CREATOR
        // Кросс: COMPANY/CREATOR добавлен к другому COMPANY/CREATOR
        linkKind =
          actorRole === Role.MANAGER ? 'companies' : 'linked';
      }

      return {
        id: membership.id,
        userId: membership.userId,
        role: membership.user.role,
        email: membership.user.email,
        displayName: this.getDisplayName(membership.user),
        actorName:
          !isOwn && isManagedProfile && actorRole === Role.MANAGER
            ? managerActorName
            : null,
        avatar: membership.user.avatar,
        membershipRole: membership.role,
        membershipId: membership.id,
        isActive: membership.userId === activeUserId,
        isVerified: membership.user.isVerified,
        isEmailConfirmed: membership.user.isEmailConfirmed,
        createdAt: membership.createdAt.toISOString(),
        linkKind,
        canSwitch: true,
      };
    });

    if (scope === 'companies') {
      return mapped.filter(item => item.linkKind === 'companies');
    }

    if (scope === 'linked') {
      const own = mapped.filter(
        item =>
          item.linkKind === 'own' &&
          (item.role === Role.COMPANY || item.role === Role.CREATOR),
      );
      const incoming = mapped.filter(item => item.linkKind === 'linked');
      if (!activeUserId) {
        return [...own, ...incoming];
      }

      // Обратная сторона кросса: партнёры, которым мы выдали доступ к своему профилю
      const outgoing = await this.listOutgoingCrossPartners(
        accountId,
        activeUserId
      );
      const seen = new Set(
        [...own, ...incoming].map(item => item.userId),
      );
      return [
        ...own,
        ...incoming,
        ...outgoing.filter(item => !seen.has(item.userId)),
      ];
    }

    return mapped;
  }

  /**
   * Кросс-партнёры на активном профиле (ADMIN + OWNER role COMPANY/CREATOR).
   * Для вкладки «Профили» у пригласившего: показать связанный аккаунт.
   */
  private async listOutgoingCrossPartners(
    actorAccountId: string,
    profileUserId: string
  ): Promise<Array<ProfileSummary & { isActive: boolean; id: string }>> {
    const membership = await this.getMembership(actorAccountId, profileUserId);
    if (
      !membership ||
      (membership.role !== MembershipRole.OWNER &&
        membership.role !== MembershipRole.ADMIN)
    ) {
      return [];
    }

    const memberships = await this.prisma.accountMembership.findMany({
      where: {
        userId: profileUserId,
        role: MembershipRole.ADMIN,
        accountId: { not: actorAccountId },
      },
      include: {
        account: {
          include: {
            memberships: {
              where: { role: MembershipRole.OWNER },
              include: {
                user: { include: userWithProfileInclude },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result: Array<ProfileSummary & { isActive: boolean; id: string }> =
      [];

    for (const item of memberships) {
      const ownerUser = item.account.memberships[0]?.user;
      if (
        !ownerUser ||
        (ownerUser.role !== Role.COMPANY && ownerUser.role !== Role.CREATOR)
      ) {
        continue;
      }

      result.push({
        id: item.id,
        userId: ownerUser.id,
        role: ownerUser.role,
        email: ownerUser.email,
        displayName: this.getDisplayName(ownerUser),
        actorName: null,
        avatar: ownerUser.avatar,
        membershipRole: item.role,
        membershipId: item.id,
        isActive: false,
        isVerified: ownerUser.isVerified,
        isEmailConfirmed: ownerUser.isEmailConfirmed,
        createdAt: item.createdAt.toISOString(),
        linkKind: 'linked',
        canSwitch: false,
      });
    }

    return result;
  }

  /**
   * Команда профиля: только менеджеры (ADMIN + account OWNER role = MANAGER).
   * Владельца и кросс-аккаунты не показываем.
   */
  async listProfileMembers(actorAccountId: string, profileUserId: string) {
    await this.assertCanManageMembers(actorAccountId, profileUserId);

    const memberships = await this.prisma.accountMembership.findMany({
      where: {
        userId: profileUserId,
        role: MembershipRole.ADMIN,
      },
      include: {
        account: {
          include: {
            memberships: {
              where: { role: MembershipRole.OWNER },
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

    const teamMembers = [];

    for (const membership of memberships) {
      const ownerUser = membership.account.memberships[0]?.user;
      if (!ownerUser || ownerUser.role !== Role.MANAGER) {
        continue;
      }

      teamMembers.push({
        accountId: membership.accountId,
        membershipId: membership.id,
        membershipRole: membership.role,
        email: membership.account.email,
        displayName: this.getManagerDisplayName(ownerUser),
        kind: 'MANAGER' as const,
      });
    }

    return teamMembers;
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

    // Менеджер не приглашает в команду/кросс от чужого профиля как owner-flow
    // (invite идёт от authUser.accountId — владелец COMPANY/CREATOR)
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

  async assertCanRevokeMembership(accountId: string, userId: string) {
    const membership = await this.assertMembership(accountId, userId);

    if (membership.role !== MembershipRole.OWNER) {
      throw new ForbiddenException(
        'Отзывать доступ может только владелец профиля',
      );
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

    await this.assertCanRevokeMembership(actorAccountId, membership.userId);

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
