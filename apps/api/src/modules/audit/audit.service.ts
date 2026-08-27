import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { withTenant, type Queryable } from '@worksyzo/db';
import { getContext } from '../../common/request-context';

export interface AuditWrite {
  orgId: string;
  actorUserId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  client?: Queryable;
}

/**
 * Append-only audit writer. Failures are logged but never break the primary
 * request - losing an audit row is preferable to failing a user signup.
 * Updates and deletes are revoked at the DB layer for worksyzo_app.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  async write(input: AuditWrite): Promise<void> {
    const ctx = getContext();
    const params = [
      input.orgId,
      input.actorUserId ?? ctx?.user?.id ?? null,
      input.action,
      input.resourceType ?? null,
      input.resourceId ?? null,
      JSON.stringify(input.metadata ?? {}),
      ctx?.ip ?? null,
      ctx?.userAgent ?? null,
    ];

    const sql = `
      INSERT INTO audit_events
        (org_id, actor_user_id, action, resource_type, resource_id, metadata, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
    `;

    try {
      if (input.client) {
        await input.client.query(sql, params);
        return;
      }

      // Prefer tenant transaction when we have an org + actor; else identity insert
      // still works because audit_events RLS requires current_org_id.
      const actor = input.actorUserId ?? ctx?.user?.id;
      if (!actor) {
        this.logger.warn(`audit skipped (no actor): ${input.action}`);
        return;
      }
      await withTenant({ orgId: input.orgId, userId: actor }, (client) =>
        client.query(sql, params),
      );
    } catch (error) {
      this.logger.error(`audit write failed for ${input.action}: ${(error as Error).message}`);
    }
  }

  async list(
    orgId: string,
    userId: string,
    opts: { limit: number; cursor?: string; action?: string },
  ) {
    return withTenant({ orgId, userId }, async (client: PoolClient) => {
      const rows = await client.query<{
        id: string;
        action: string;
        resource_type: string | null;
        resource_id: string | null;
        actor_user_id: string | null;
        actor_name: string | null;
        metadata: Record<string, unknown>;
        ip: string | null;
        created_at: Date;
      }>(
        `SELECT e.id, e.action, e.resource_type, e.resource_id, e.actor_user_id,
                u.name AS actor_name, e.metadata, e.ip, e.created_at
         FROM audit_events e
         LEFT JOIN users u ON u.id = e.actor_user_id
         WHERE ($1::text IS NULL OR e.action = $1)
           AND ($2::timestamptz IS NULL OR e.created_at < $2::timestamptz)
         ORDER BY e.created_at DESC
         LIMIT $3`,
        [opts.action ?? null, opts.cursor ?? null, opts.limit],
      );

      return rows.rows.map((r) => ({
        id: r.id,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        actorUserId: r.actor_user_id,
        actorName: r.actor_name,
        metadata: r.metadata,
        ip: r.ip,
        createdAt: r.created_at.toISOString(),
      }));
    });
  }
}
