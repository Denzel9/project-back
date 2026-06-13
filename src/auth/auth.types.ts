import { MembershipRole, Role } from '@prisma/client';
import { ContactItem } from '../users/dto/contact-item.dto';
import { Person } from '../users/dto/person.dto';

export type JwtPayload = {
  sub: string;
  accountId: string;
  email: string;
  role: Role;
  membershipRole: MembershipRole;
};

export type RefreshJwtPayload = {
  sub: string;
  accountId: string;
  type: 'refresh';
  remember?: boolean;
};

export type AuthCookieOptions = {
  rememberMe?: boolean;
};

export type PasswordResetPayload = {
  sub: string;
  type: 'password-reset';
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = {
  userId: string;
  accountId: string;
  email: string;
  role: Role;
  membershipRole: MembershipRole;
};

export type SafeUser = {
  id: string;
  role: Role;
  contacts: ContactItem[] | null;
  person: Person | null;
  phone: string | null;
  location: string | null;
  avatar: string | null;
  bio: string | null;
  followers: number;
  aboutMe: string | null;
  name?: string;
  lastName?: string;
  companyName?: string;
};

export type UserProfileFields = {
  contacts?: ContactItem[] | null;
  person?: Person | null;
  phone?: string | null;
  location?: string | null;
  avatar?: string | null;
  bio?: string | null;
  aboutMe?: string | null;
};

export type AuthSessionUser = {
  id: string;
  role: Role;
  membershipRole: MembershipRole;
};

export type AuthResponse = {
  user: AuthSessionUser;
  tokens: AuthTokens;
  rememberMe: boolean;
};
