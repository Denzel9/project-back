import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { UserProfileFields } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { Person, PersonPatch } from './dto/person.dto';
import { UpdateUserDto } from './dto/update.dto';

const userWithProfileInclude = {
  creatorProfile: true,
  companyProfile: true,
} as const;

const PERSON_KEYS = [
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
      include: userWithProfileInclude,
    });
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

    const resolvedFields: UserProfileFields & { banner?: string | null } = {
      ...profileFields,
      ...(mergedPerson !== undefined && { person: mergedPerson }),
    };

    if (user.role === Role.CREATOR) {
      return this.updateCreator(userId, {
        ...resolvedFields,
        name: name !== undefined ? name : creatorProfile?.name,
        lastName: lastName !== undefined ? lastName : creatorProfile?.lastName,
      });
    }

    if (user.role === Role.COMPANY) {
      return this.updateCompany(userId, {
        ...resolvedFields,
        companyName:
          companyName !== undefined ? companyName : companyProfile?.companyName,
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...this.mapProfileFields(resolvedFields),
        ...(resolvedFields.banner !== undefined && {
          banner: resolvedFields.banner,
        }),
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
    }
  ) {
    const { creatorProfile, companyProfile } = nested ?? {};

    const userData = {
      ...this.mapProfileFields(fields),
      ...(fields.banner !== undefined && { banner: fields.banner }),
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
    });
  }
}
