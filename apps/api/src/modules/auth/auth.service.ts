import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  hashPassword,
  queryOne,
  queryRows,
  verifyPassword,
  withIdentity,
  withIdentityTransaction,
  withNewTenantTransaction,
  type MembershipRow,
  type OrganizationRow,
  type UserRow,
} from '@worksyzo/db';
import {
  AUDIT_ACTIONS,
  slugify,
  type LoginInput,
  type OrgSummary,
  type PublicUser,
  type RegisterInput,
  type SessionResponse,
} from '@worksyzo/shared';
import { AuditService } from '../audit/audit.service';
import { SessionService } from './session.service';
import { getContext } from '../../common/request-context';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput): Promise<{ sessionToken: string; session: SessionResponse }> {
    const passwordHash = await hashPassword(input.password);
    const baseSlug = slugify(input.orgName);

    // Pre-check email to give a clear conflict before the transaction.
    const existing = await withIdentity((c) =>
      queryOne<{ id: string }>(c, 'SELECT id FROM users WHERE lower(email) = lower($1)', [
        input.email,
      ]),
    );
    if (existing) {
      throw new ConflictException('An account with this email already exists. Sign in instead.');
    }

    const created = await withIdentityTransaction(async (client) => {
      const user = await queryOne<UserRow>(
        client,
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.email, input.name, passwordHash],
      );
      if (!user) throw new Error('Failed to create user');

      const slug = await this.allocateSlug(client, baseSlug);
      const org = await queryOne<OrganizationRow>(
        client,
        `INSERT INTO organizations (name, slug, plan_code, status)
         VALUES ($1, $2, 'trial', 'trial')
         RETURNING *`,
        [input.orgName, slug],
      );
      if (!org) throw new Error('Failed to create organization');

      await client.query(
        `INSERT INTO org_memberships (org_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'owner', 'active', now())`,
        [org.id, user.id],
      );

      return { user, org };
    });

    // Subscriptions + audit live behind FORCE RLS - must run with tenant context.
    await withNewTenantTransaction(created.org.id, created.user.id, async (client) => {
      await client.query(
        `INSERT INTO subscriptions (org_id, plan_code, status, trial_ends_at, current_period_end)
         VALUES ($1, 'trial', 'trialing', now() + interval '14 days', now() + interval '14 days')`,
        [created.org.id],
      );
      await this.audit.write({
        client,
        orgId: created.org.id,
        actorUserId: created.user.id,
        action: AUDIT_ACTIONS.orgCreated,
        resourceType: 'organization',
        resourceId: created.org.id,
        metadata: { name: created.org.name, via: 'register' },
      });
      await this.audit.write({
        client,
        orgId: created.org.id,
        actorUserId: created.user.id,
        action: AUDIT_ACTIONS.userRegistered,
        resourceType: 'user',
        resourceId: created.user.id,
      });
    });

    const ctx = getContext();
    const sessionToken = await this.sessions.create(created.user.id, {
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
    });

    return {
      sessionToken,
      session: await this.buildSession(created.user.id),
    };
  }

  async login(input: LoginInput): Promise<{ sessionToken: string; session: SessionResponse }> {
    const user = await withIdentity((c) =>
      queryOne<UserRow>(c, 'SELECT * FROM users WHERE lower(email) = lower($1)', [input.email]),
    );

    // Constant-ish failure path: still run a hash compare when user is missing
    // so timing does not advertise which emails exist.
    const ok = await verifyPassword(input.password, user?.password_hash ?? null);
    if (!user || !ok) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    await withIdentity((c) =>
      c.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]),
    );

    const ctx = getContext();
    const sessionToken = await this.sessions.create(user.id, {
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
    });

    // Best-effort login audit on each org the user belongs to (capped).
    const orgs = await this.listOrgsForUser(user.id);
    for (const org of orgs.slice(0, 5)) {
      await this.audit.write({
        orgId: org.id,
        actorUserId: user.id,
        action: AUDIT_ACTIONS.userLogin,
        resourceType: 'user',
        resourceId: user.id,
      });
    }

    return { sessionToken, session: await this.buildSession(user.id) };
  }

  async buildSession(userId: string): Promise<SessionResponse> {
    const user = await withIdentity((c) =>
      queryOne<UserRow>(c, 'SELECT * FROM users WHERE id = $1', [userId]),
    );
    if (!user) throw new UnauthorizedException('User not found');

    const organizations = await this.listOrgsForUser(userId);

    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
    };

    return { user: publicUser, organizations };
  }

  private async listOrgsForUser(userId: string): Promise<OrgSummary[]> {
    const rows = await withIdentity((c) =>
      queryRows<OrganizationRow & MembershipRow>(
        c,
        `SELECT o.*, m.role, m.status AS membership_status
         FROM org_memberships m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = $1
           AND m.status = 'active'
           AND o.deleted_at IS NULL
         ORDER BY o.name ASC`,
        [userId],
      ),
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      planCode: r.plan_code,
      status: r.status,
      role: r.role,
    }));
  }

  private async allocateSlug(
    client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { slug: string }[] }> },
    base: string,
  ): Promise<string> {
    let candidate = base;
    for (let i = 0; i < 20; i += 1) {
      const hit = await client.query('SELECT slug FROM organizations WHERE slug = $1', [candidate]);
      if (hit.rows.length === 0) return candidate;
      candidate = `${base}-${i + 2}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
