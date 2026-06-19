import { ACCESS_TOKEN_COOKIE } from '../auth/auth-cookies';
import type { IncomingHttpHeaders } from 'http';

function parseCookieValue(
  cookieHeader: string | undefined,
  name: string
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const [rawKey, ...rawValue] = cookie.trim().split('=');

    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}

export function extractAccessTokenFromHandshake(input: {
  headers?: IncomingHttpHeaders;
  auth?: { token?: string };
}): string | null {
  const authToken = input.auth?.token;

  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  const cookieToken = parseCookieValue(
    input.headers?.cookie,
    ACCESS_TOKEN_COOKIE
  );

  if (cookieToken) {
    return cookieToken;
  }

  const authorization = input.headers?.authorization;

  if (
    typeof authorization === 'string' &&
    authorization.startsWith('Bearer ')
  ) {
    return authorization.slice('Bearer '.length);
  }

  return null;
}
