import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
] as const;

const PRIVATE_LAN_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

function configuredOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string): boolean {
  const allowed = new Set<string>([...LOCAL_ORIGINS, ...configuredOrigins()]);
  if (allowed.has(origin)) {
    return true;
  }

  return process.env.NODE_ENV !== 'production' && PRIVATE_LAN_ORIGIN_RE.test(origin);
}

/** Shared CORS for HTTP and Socket.IO (credentials + LAN origins in dev). */
export function buildCorsOptions(): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  };
}

/** Socket.IO accepts boolean | string | string[] | ReflectFunction — not Nest's callback form. */
export function buildSocketCorsOrigin():
  | boolean
  | string
  | string[]
  | RegExp
  | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void) {
  return (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };
}
