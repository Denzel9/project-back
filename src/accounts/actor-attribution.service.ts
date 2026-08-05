import { Injectable } from '@nestjs/common';
import { MessageActorKind, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ActorSnapshot = {
  accountId: string;
  displayName: string;
  kind: MessageActorKind;
};

export type ActorPrismaFields = {
  actorAccountId: string;
  actorDisplayName: string;
  actorKind: MessageActorKind;
};

@Injectable()
export class ActorAttributionService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    accountId: string,
    activeUserId: string
  ): Promise<ActorSnapshot> {
    const memberships = await this.prisma.accountMembership.findMany({
      where: { accountId },
      include: {
        user: {
          include: {
            creatorProfile: true,
            companyProfile: true,
          },
        },
      },
    });

    const managerMembership = memberships.find(
      membership => membership.user.role === Role.MANAGER
    );

    if (managerMembership) {
      return {
        accountId,
        kind: MessageActorKind.MANAGER,
        displayName: this.getManagerDisplayName(managerMembership.user),
      };
    }

    const senderMembership = memberships.find(
      membership => membership.userId === activeUserId
    );
    const senderUser =
      senderMembership?.user ??
      (await this.prisma.user.findUnique({
        where: { id: activeUserId },
        include: {
          creatorProfile: true,
          companyProfile: true,
        },
      }));

    return {
      accountId,
      kind: MessageActorKind.OWNER,
      displayName: senderUser
        ? this.getProfileDisplayName(senderUser)
        : 'Компания',
    };
  }

  toPrismaFields(actor: ActorSnapshot | null | undefined): Partial<ActorPrismaFields> {
    if (!actor) return {};

    return {
      actorAccountId: actor.accountId,
      actorDisplayName: actor.displayName,
      actorKind: actor.kind,
    };
  }

  private getManagerDisplayName(user: {
    email?: string | null;
    person?: unknown;
  }): string {
    const fromPerson = this.getPersonFullName(user.person);
    if (fromPerson) return fromPerson;
    return user.email ?? 'Менеджер';
  }

  private getProfileDisplayName(user: {
    role: Role;
    email?: string | null;
    person?: unknown;
    creatorProfile: { name: string; lastName: string } | null;
    companyProfile: { companyName: string } | null;
  }): string {
    if (user.role === Role.CREATOR && user.creatorProfile) {
      return `${user.creatorProfile.name} ${user.creatorProfile.lastName}`.trim();
    }

    if (user.role === Role.COMPANY && user.companyProfile) {
      return user.companyProfile.companyName;
    }

    if (user.role === Role.MANAGER) {
      return this.getManagerDisplayName(user);
    }

    return user.email ?? user.role;
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
