import { Injectable } from '@nestjs/common';
import {
  generateToken,
  hashToken,
  queryOne,
  withIdentity,
  type SessionRow,
  type UserRow,
} from '@worksyzo/db';
import type { AuthenticatedUser } from '../../common/request-context';
import { config } from '../../config';

@Injectable()
export class SessionService {
  async create(userId: string, meta: { ip: string | null; userAgent: string | null }): Promise<string> {
    const raw = generateToken('wsz', 32);
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + config.session.ttlDays * 24 * 60 * 60 * 1000);

    await withIdentity((client) =>
      client.query(
        `INSERT INTO user_sessions (user_id, token_hash, expires_at, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, tokenHash, expiresAt.toISOString(), meta.ip, meta.userAgent],
      ),
    );

    return raw;
  }

  async resolve(rawToken: string): Promise<AuthenticatedUser | null> {
    const tokenHash = hashToken(rawToken);
    return withIdentity(async (client) => {
      const row = await queryOne<SessionRow & Pick<UserRow, 'email' | 'name'>>(
        client,
        `SELECT s.*, u.email, u.name
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1
           AND s.revoked_at IS NULL
           AND s.expires_at > now()`,
        [tokenHash],
      );
      if (!row) return null;

      // Touch last_seen sparsely (at most once per minute) to keep the write cheap.
      if (Date.now() - row.last_seen_at.getTime() > 60_000) {
        await client.query(
          'UPDATE user_sessions SET last_seen_at = now() WHERE id = $1',
          [row.id],
        );
      }

      return {
        id: row.user_id,
        email: row.email,
        name: row.name,
        sessionId: row.id,
      };
    });
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await withIdentity((client) =>
      client.query(
        'UPDATE user_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
        [tokenHash],
      ),
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await withIdentity((client) =>
      client.query(
        'UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId],
      ),
    );
  }
}
