import { MembershipRole, PrimeStatus, Role } from '@prisma/client';
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
  /** ID записи RefreshSession */
  jti: string;
  remember?: boolean;
};

export type AuthCookieOptions = {
  rememberMe?: boolean;
};

export type PasswordResetPayload = {
  sub: string;
  type: 'password-reset';
};

export type EmailConfirmPayload = {
  sub: string;
  accountId: string;
  type: 'email-confirm';
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
  isVerified: boolean;
  isEmailConfirmed: boolean;
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
  email?: string | null;
};

export type AuthSessionUser = {
  id: string;
  accountId: string;
  role: Role;
  membershipRole: MembershipRole;
  isVerified: boolean;
  isEmailConfirmed: boolean;
  isPrime: boolean;
  primeStatus: PrimeStatus;
  primeExpiresAt: string | null;
};

export type AuthResponse = {
  user: AuthSessionUser;
  tokens: AuthTokens;
  rememberMe: boolean;
};
