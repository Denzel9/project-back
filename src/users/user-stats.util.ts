import { Prisma, TaskStatus } from '@prisma/client';
import { ApplicationOwnerDto } from '../applications/dto/application-owner.dto';

export const userStatsCountSelect = {
  favoritedByUsers: true,
  ownedTasks: { where: { status: TaskStatus.COMPLETED } },
  executedTasks: { where: { status: TaskStatus.COMPLETED } },
} satisfies Prisma.UserCountOutputTypeSelect;

export type UserStatsCount = {
  favoritedByUsers: number;
  ownedTasks: number;
  executedTasks: number;
};

export type UserPublicStats = {
  followers: number;
  completedTasksCount: number;
};

export const userOwnerWithStatsSelect = {
  id: true,
  avatar: true,
  creatorProfile: {
    select: {
      name: true,
      lastName: true,
    },
  },
  companyProfile: {
    select: {
      companyName: true,
    },
  },
  _count: {
    select: userStatsCountSelect,
  },
} satisfies Prisma.UserSelect;

export type UserOwnerWithStats = {
  id: string;
  avatar: string | null;
  creatorProfile: {
    name: string;
    lastName: string;
  } | null;
  companyProfile: {
    companyName: string;
  } | null;
  _count: UserStatsCount;
};

export function mapUserPublicStats(count: UserStatsCount): UserPublicStats {
  return {
    followers: count.favoritedByUsers,
    completedTasksCount: count.ownedTasks + count.executedTasks,
  };
}

export function mapOwnerWithStats(owner: UserOwnerWithStats): ApplicationOwnerDto {
  return {
    id: owner.id,
    avatar: owner.avatar ?? undefined,
    ...mapUserPublicStats(owner._count),
    ...(owner.creatorProfile && {
      creatorProfile: {
        name: owner.creatorProfile.name,
        lastName: owner.creatorProfile.lastName,
      },
    }),
    ...(owner.companyProfile && {
      companyProfile: {
        companyName: owner.companyProfile.companyName,
      },
    }),
  };
}
