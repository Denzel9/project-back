import { Prisma, Role } from '@prisma/client';
import { ContactItem } from '../users/dto/contact-item.dto';
import { Person } from '../users/dto/person.dto';
import { FavoriteUserProfileDto } from './dto/favorite-user-response.dto';

const PERSON_KEYS = [
  'height',
  'weight',
  'size',
  'birthday',
  'gender',
  'parameters',
] as const;

type UserWithProfiles = Prisma.UserGetPayload<{
  include: {
    creatorProfile: true;
    companyProfile: true;
  };
}>;

function parsePerson(value: unknown): Person | null {
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

function parseContacts(value: unknown): ContactItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value as ContactItem[];
}

export function mapFavoriteUserProfile(
  user: UserWithProfiles
): FavoriteUserProfileDto {
  const profile: FavoriteUserProfileDto = {
    id: user.id,
    role: user.role,
    avatar: user.avatar,
    bio: user.bio,
    followers: user.followers,
    location: user.location,
    aboutMe: user.aboutMe,
    banner: user.banner,
    contacts: parseContacts(user.contacts),
    person: parsePerson(user.person),
  };

  if (user.role === Role.CREATOR && user.creatorProfile) {
    profile.name = user.creatorProfile.name;
    profile.lastName = user.creatorProfile.lastName;
  }

  if (user.role === Role.COMPANY && user.companyProfile) {
    profile.companyName = user.companyProfile.companyName;
  }

  return profile;
}
