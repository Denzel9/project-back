import type { CookieOptions, Response } from 'express';
import type { AuthCookieOptions, AuthTokens } from './auth.types';

export const ACCESS_TOKEN_COOKIE = 'access-token';
export const REFRESH_TOKEN_COOKIE = 'refresh-token';

function getCookieOptions(maxAgeMs: number): CookieOptions {
  const sameSite = (process.env.COOKIE_SAME_SITE ?? 'none') as
    | 'lax'
    | 'strict'
    | 'none';

  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || sameSite === 'none',
    sameSite,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function parseExpiresInToMs(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

export function getRefreshExpiresIn(rememberMe = false): string {
  if (rememberMe) {
    return process.env.JWT_REFRESH_EXPIRES_IN_REMEMBER ?? '30d';
  }

  return process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
}

export function setAuthCookies(
  res: Response,
  tokens: AuthTokens,
  options: AuthCookieOptions = {}
): void {
  const rememberMe = options.rememberMe ?? false;
  const accessMaxAge = parseExpiresInToMs(
    process.env.JWT_ACCESS_EXPIRES_IN ?? '15m'
  );
  const refreshMaxAge = parseExpiresInToMs(getRefreshExpiresIn(rememberMe));

  res.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    getCookieOptions(accessMaxAge)
  );
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    getCookieOptions(refreshMaxAge)
  );
}

export function clearAuthCookies(res: Response): void {
  const options: CookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAME_SITE ?? 'none') as
      | 'lax'
      | 'strict'
      | 'none',
    path: '/',
  };

  res.clearCookie(ACCESS_TOKEN_COOKIE, options);
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
}
