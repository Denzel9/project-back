import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, PrimeStatus } from '@prisma/client';
import { AccountMembershipService } from '../accounts/account-membership.service';
import { PrismaService } from '../prisma/prisma.service';

export type PrimeSubscriptionView = {
  status: PrimeStatus;
  expiresAt: Date | null;
  startedAt: Date | null;
  isPrime: boolean;
};

const DEFAULT_ACTIVATE_DAYS = 365;

@Injectable()
export class PrimeSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipService: AccountMembershipService
  ) {}

  isPrimeActive(input: {
    primeStatus: PrimeStatus;
    primeExpiresAt: Date | null;
  }): boolean {
    if (input.primeStatus !== PrimeStatus.ACTIVE) {
      return false;
    }

    if (input.primeExpiresAt === null) {
      return true;
    }

    return input.primeExpiresAt.getTime() > Date.now();
  }

  async getSubscription(userId: string): Promise<PrimeSubscriptionView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        primeStatus: true,
        primeExpiresAt: true,
        primeStartedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Профиль не найден');
    }

    return this.syncAndMap(userId, user);
  }

  async activateStub(
    accountId: string,
    userId: string,
    options?: { days?: number }
  ): Promise<PrimeSubscriptionView> {
    await this.assertCanManageSubscription(accountId, userId);

    const days = options?.days ?? DEFAULT_ACTIVATE_DAYS;
    const now = new Date();
    const expiresAt =
      days > 0 ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000) : null;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        primeStatus: PrimeStatus.ACTIVE,
        primeStartedAt: now,
        primeExpiresAt: expiresAt,
      },
      select: {
        primeStatus: true,
        primeExpiresAt: true,
        primeStartedAt: true,
      },
    });

    return this.toView(user);
  }

  async deactivateStub(
    accountId: string,
    userId: string
  ): Promise<PrimeSubscriptionView> {
    await this.assertCanManageSubscription(accountId, userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        primeStatus: PrimeStatus.CANCELED,
        primeExpiresAt: new Date(),
      },
      select: {
        primeStatus: true,
        primeExpiresAt: true,
        primeStartedAt: true,
      },
    });

    return this.toView(user);
  }

  async assertPrime(userId: string): Promise<void> {
    const subscription = await this.getSubscription(userId);

    if (!subscription.isPrime) {
      throw new ForbiddenException('Требуется Prime-подписка');
    }
  }

  private async assertCanManageSubscription(
    accountId: string,
    userId: string
  ) {
    const membership = await this.membershipService.assertMembership(
      accountId,
      userId
    );

    if (
      membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Недостаточно прав для управления подпиской'
      );
    }

    return membership;
  }

  private async syncAndMap(
    userId: string,
    user: {
      primeStatus: PrimeStatus;
      primeExpiresAt: Date | null;
      primeStartedAt: Date | null;
    }
  ): Promise<PrimeSubscriptionView> {
    if (
      user.primeStatus === PrimeStatus.ACTIVE &&
      user.primeExpiresAt !== null &&
      user.primeExpiresAt.getTime() <= Date.now()
    ) {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { primeStatus: PrimeStatus.EXPIRED },
        select: {
          primeStatus: true,
          primeExpiresAt: true,
          primeStartedAt: true,
        },
      });

      return this.toView(updated);
    }

    return this.toView(user);
  }

  private toView(user: {
    primeStatus: PrimeStatus;
    primeExpiresAt: Date | null;
    primeStartedAt: Date | null;
  }): PrimeSubscriptionView {
    return {
      status: user.primeStatus,
      expiresAt: user.primeExpiresAt,
      startedAt: user.primeStartedAt,
      isPrime: this.isPrimeActive(user),
    };
  }
}
