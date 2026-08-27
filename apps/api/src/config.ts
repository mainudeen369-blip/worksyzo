import { optionalEnv, requireEnv } from '@worksyzo/db';

function readSessionSecret(): string {
  const secret = requireEnv('SESSION_SECRET');
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production');
  }
  return secret;
}

export const config = {
  env: optionalEnv('NODE_ENV', 'development'),
  get isProduction(): boolean {
    return this.env === 'production';
  },
  port: Number(optionalEnv('API_PORT', '4000')),
  webOrigin: optionalEnv('WEB_ORIGIN', 'http://localhost:3000'),
  session: {
    cookieName: 'wsz_session',
    secret: readSessionSecret(),
    ttlDays: Number(optionalEnv('SESSION_TTL_DAYS', '30')),
    secure: optionalEnv('COOKIE_SECURE', 'false') === 'true',
  },
  invites: {
    ttlDays: 14,
  },
  rateLimits: {
    loginPerIpPerMinute: 10,
    invitesPerOrgPerHour: 50,
  },
} as const;
