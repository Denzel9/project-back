import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { UserProfileFields } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update.dto';

const userWithProfileInclude = {
  creatorProfile: true,
  companyProfile: true,
} as const;

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
};

type UpdateCompanyData = UserProfileFields & {
  companyName?: string;
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
    const creatorProfile = this.pickDefined({ name, lastName });

    return this.updateUser(userId, profileFields, { creatorProfile });
  }

  updateCompany(userId: string, data: UpdateCompanyData) {
    const { companyName, ...profileFields } = data;
    const companyProfile = this.pickDefined({ companyName });

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

    if (user.role === Role.CREATOR) {
      return this.updateCreator(userId, {
        ...profileFields,
        name: name ?? creatorProfile?.name,
        lastName: lastName ?? creatorProfile?.lastName,
      });
    }

    if (user.role === Role.COMPANY) {
      return this.updateCompany(userId, {
        ...profileFields,
        companyName: companyName ?? companyProfile?.companyName,
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: this.mapProfileFields(profileFields),
      include: userWithProfileInclude,
    });
  }

  private updateUser(
    userId: string,
    fields: UserProfileFields & { banner?: string },
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

  private pickDefined<T extends Record<string, unknown>>(fields: T) {
    return Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
  }

  private hasFields(value?: Record<string, unknown>) {
    return value !== undefined && Object.keys(value).length > 0;
  }

  private mapProfileFields(fields: UserProfileFields) {
    return this.pickDefined({
      contacts: fields.contacts,
      phone: fields.phone,
      location: fields.location,
      avatar: fields.avatar,
      bio: fields.bio,
      aboutMe: fields.aboutMe,
    });
  }
}
