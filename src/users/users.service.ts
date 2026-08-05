import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, Prisma, Role } from '@prisma/client';
import { AuthUser, UserProfileFields } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { Person, PersonPatch } from './dto/person.dto';
import { UpdateUserDto } from './dto/update.dto';
import {
  mapUserPublicStats,
  userStatsCountSelect,
} from './user-stats.util';

const userWithProfileInclude = {
  creatorProfile: true,
  companyProfile: true,
} as const;

const userWithPublicStatsInclude = {
  ...userWithProfileInclude,
  _count: {
    select: userStatsCountSelect,
  },
} as const;

const PERSON_KEYS = [
  'name',
  'lastName',
  'height',
  'weight',
  'size',
  'birthday',
  'gender',
  'parameters',
] as const;

type CreateCreatorData = {
  email: string;
  name: string;
  lastName: string;
} & UserProfileFields;

type CreateCompanyData = {
  email: string;
  companyName: string;
} & UserProfileFields;

type UpdateCreatorData = UserProfileFields & {
  name?: string;
  lastName?: string;
  banner?: string | null;
};

type UpdateCompanyData = UserProfileFields & {
  companyName?: string;
  banner?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        ...userWithProfileInclude,
      },
    });
  }

  async findPublicById(
    id: string,
    viewerAccountId: string,
    viewerUserId: string
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userWithPublicStatsInclude,
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const membership =
      viewerUserId === id
        ? { id: 'self' }
        : await this.prisma.accountMembership.findUnique({
          where: {
            accountId_userId: {
              accountId: viewerAccountId,
              userId: id,
            },
          },
          select: { id: true },
        });

    const { email, isEmailConfirmed, _count, ...publicUser } = user;
    const stats = mapUserPublicStats(_count);

    if (membership) {
      return { ...publicUser, ...stats, isEmailConfirmed, email };
    }

    return { ...publicUser, ...stats, email };
  }

  async search(
    viewer: AuthUser,
    query: { q: string; page?: number; limit?: number }
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const q = query.q.trim();
    const roles = this.getChatSearchRoles(viewer);

    if (roles.length === 0) {
      return { items: [], total: 0, page, limit };
    }

    const where: Prisma.UserWhereInput = {
      id: { not: viewer.userId },
      role: { in: roles },
      OR: [
        { creatorProfile: { name: { contains: q, mode: 'insensitive' } } },
        { creatorProfile: { lastName: { contains: q, mode: 'insensitive' } } },
        {
          companyProfile: {
            companyName: { contains: q, mode: 'insensitive' },
          },
        },
      ],
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: userWithProfileInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map(user => ({
        id: user.id,
        role: user.role,
        avatar: user.avatar,
        displayName: this.getSearchDisplayName(user),
      })),
      total,
      page,
      limit,
    };
  }

  private getChatSearchRoles(viewer: AuthUser): Role[] {
    if (
      viewer.role === Role.MANAGER ||
      viewer.membershipRole === MembershipRole.ADMIN
    ) {
      return [Role.CREATOR, Role.COMPANY];
    }

    if (viewer.role === Role.COMPANY) {
      return [Role.CREATOR];
    }

    if (viewer.role === Role.CREATOR) {
      return [Role.COMPANY];
    }

    return [];
  }

  private getSearchDisplayName(user: {
    role: Role;
    email?: string | null;
    creatorProfile: { name: string; lastName: string } | null;
    companyProfile: { companyName: string } | null;
  }): string {
    if (user.role === Role.CREATOR && user.creatorProfile) {
      return `${user.creatorProfile.name} ${user.creatorProfile.lastName}`.trim();
    }

    if (user.role === Role.COMPANY && user.companyProfile) {
      return user.companyProfile.companyName;
    }

    return user.email ?? user.role;
  }

  createCreator(data: CreateCreatorData) {
    const { email, name, lastName, ...profile } = data;

    return this.prisma.user.create({
      data: {
        email,
        role: Role.CREATOR,
        ...this.mapProfileFields(profile),
        creatorProfile: {
          create: { name, lastName },
        },
      },
      include: userWithProfileInclude,
    });
  }

  createCompany(data: CreateCompanyData) {
    const { email, companyName, ...profile } = data;

    return this.prisma.user.create({
      data: {
        email,
        role: Role.COMPANY,
        ...this.mapProfileFields(profile),
        companyProfile: {
          create: { companyName },
        },
      },
      include: userWithProfileInclude,
    });
  }

  updateCreator(userId: string, data: UpdateCreatorData) {
    const { name, lastName, ...profileFields } = data;
    const creatorProfile = this.pickPresent({ name, lastName });

    return this.updateUser(userId, profileFields, { creatorProfile });
  }

  updateCompany(userId: string, data: UpdateCompanyData) {
    const { companyName, ...profileFields } = data;
    const companyProfile = this.pickPresent({ companyName });

    return this.updateUser(userId, profileFields, { companyProfile });
  }

  async update(userId: string, data: UpdateUserDto) {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const {
      name,
      lastName,
      companyName,
      creatorProfile,
      companyProfile,
      email,
      ...profileFields
    } = data;

    if (name === null || lastName === null) {
      throw new BadRequestException(
        'Поля name и lastName нельзя очистить (передайте новое значение)'
      );
    }

    if (companyName === null) {
      throw new BadRequestException(
        'Поле companyName нельзя очистить (передайте новое значение)'
      );
    }

    const mergedPerson = this.mergePerson(
      this.parsePerson(user.person),
      profileFields.person
    );

    const emailChanged =
      email !== undefined &&
      email.trim().toLowerCase() !== (user.email ?? '').trim().toLowerCase();

    const resolvedFields: UserProfileFields & { banner?: string | null } = {
      ...profileFields,
      ...(mergedPerson !== undefined && { person: mergedPerson }),
      ...(email !== undefined && { email: email.trim() }),
    };

    if (user.role === Role.CREATOR) {
      return this.updateUser(
        userId,
        resolvedFields,
        {
          creatorProfile: this.pickPresent({
            name: name !== undefined ? name : creatorProfile?.name,
            lastName:
              lastName !== undefined ? lastName : creatorProfile?.lastName,
          }),
        },
        emailChanged
      );
    }

    if (user.role === Role.COMPANY) {
      return this.updateUser(
        userId,
        resolvedFields,
        {
          companyProfile: this.pickPresent({
            companyName:
              companyName !== undefined
                ? companyName
                : companyProfile?.companyName,
          }),
        },
        emailChanged
      );
    }

    if (user.role === Role.MANAGER) {
      if (
        name !== undefined ||
        lastName !== undefined ||
        companyName !== undefined ||
        creatorProfile !== undefined ||
        companyProfile !== undefined
      ) {
        throw new BadRequestException(
          'У профиля менеджера нет полей витрины'
        );
      }

      return this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(email !== undefined && { email: email.trim() }),
          ...(emailChanged && { isEmailConfirmed: false }),
          ...(profileFields.phone !== undefined && {
            phone: profileFields.phone,
          }),
          ...(profileFields.avatar !== undefined && {
            avatar: profileFields.avatar,
          }),
          ...(mergedPerson !== undefined && {
            person: this.toNullableJson(mergedPerson),
          }),
        },
        include: userWithProfileInclude,
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...this.mapProfileFields(resolvedFields),
        ...(resolvedFields.banner !== undefined && {
          banner: resolvedFields.banner,
        }),
        ...(emailChanged && { isEmailConfirmed: false }),
      },
      include: userWithProfileInclude,
    });
  }

  private updateUser(
    userId: string,
    fields: UserProfileFields & { banner?: string | null },
    nested?: {
      creatorProfile?: Partial<{ name: string; lastName: string }>;
      companyProfile?: Partial<{ companyName: string }>;
    },
    resetEmailConfirmed = false
  ) {
    const { creatorProfile, companyProfile } = nested ?? {};

    const userData = {
      ...this.mapProfileFields(fields),
      ...(fields.banner !== undefined && { banner: fields.banner }),
      ...(resetEmailConfirmed && { isEmailConfirmed: false }),
      ...(this.hasFields(creatorProfile) && {
        creatorProfile: { update: creatorProfile },
      }),
      ...(this.hasFields(companyProfile) && {
        companyProfile: { update: companyProfile },
      }),
    };

    return this.prisma.user.update({
      where: { id: userId },
      data: userData,
      include: userWithProfileInclude,
    });
  }

  private mergePerson(
    existing: Person | null,
    incoming: PersonPatch | null | undefined
  ): Person | null | undefined {
    if (incoming === undefined) {
      return undefined;
    }

    if (incoming === null) {
      return null;
    }

    const merged: Record<string, string> = { ...(existing ?? {}) };

    for (const key of PERSON_KEYS) {
      if (!(key in incoming)) {
        continue;
      }

      const value = incoming[key];

      if (value === null) {
        delete merged[key];
      } else if (value !== undefined) {
        merged[key] = value;
      }
    }

    return Object.keys(merged).length > 0 ? merged : null;
  }

  private parsePerson(value: unknown): Person | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const person: Person = {};

    for (const key of PERSON_KEYS) {
      if (typeof record[key] === 'string') {
        person[key] = record[key];
      }
    }

    return Object.keys(person).length > 0 ? person : null;
  }

  private pickPresent<T extends Record<string, unknown>>(fields: T) {
    return Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
  }

  private hasFields(value?: Record<string, unknown>) {
    return value !== undefined && Object.keys(value).length > 0;
  }

  /** undefined — не обновлять; null — очистить; иначе — записать в Json-колонку */
  private toNullableJson<T>(value: T | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return value as Prisma.InputJsonValue;
  }

  private mapProfileFields(fields: UserProfileFields) {
    return this.pickPresent({
      contacts: this.toNullableJson(fields.contacts),
      person: this.toNullableJson(fields.person),
      phone: fields.phone,
      location: fields.location,
      avatar: fields.avatar,
      bio: fields.bio,
      aboutMe: fields.aboutMe,
      email: fields.email,
    });
  }
}
