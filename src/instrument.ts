import { config as loadEnv } from 'dotenv';
import * as Sentry from '@sentry/nestjs';

loadEnv();

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  const tracesSampleRate = Number(
    process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'
  );

  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      'development',
    tracesSampleRate: Number.isFinite(tracesSampleRate)
      ? tracesSampleRate
      : 0.1,
    sendDefaultPii: false,
  });
}
