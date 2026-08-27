import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  queryOne,
  withIdentity,
  withTenant,
  type OrganizationRow,
  type SubscriptionRow,
  type UsageLimitRow,
} from '@worksyzo/db';
import { AUDIT_ACTIONS, type UpdateOrgInput, type UsageSnapshot } from '@worksyzo/shared';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrgsService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async get(orgId: string, userId: string) {
    const org = await withIdentity((c) =>
      queryOne<OrganizationRow>(
        c,
        'SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL',
        [orgId],
      ),
    );
    if (!org) throw new NotFoundException('Organization not found');

    // Touch tenant context so later RLS-backed reads in the same request path work.
    await withTenant({ orgId, userId }, async () => undefined);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      planCode: org.plan_code,
      status: org.status,
      createdAt: org.created_at.toISOString(),
    };
  }

  async update(orgId: string, userId: string, input: UpdateOrgInput) {
    if (input.name) {
      await withIdentity((c) =>
        c.query(
          'UPDATE organizations SET name = $2, updated_at = now() WHERE id = $1',
          [orgId, input.name],
        ),
      );
      await this.audit.write({
        orgId,
        actorUserId: userId,
        action: AUDIT_ACTIONS.orgUpdated,
        resourceType: 'organization',
        resourceId: orgId,
        metadata: { name: input.name },
      });
    }
    return this.get(orgId, userId);
  }

  async usage(orgId: string, userId: string): Promise<UsageSnapshot> {
    return withTenant({ orgId, userId }, async (client) => {
      const org = await withIdentity((c) =>
        queryOne<OrganizationRow>(c, 'SELECT * FROM organizations WHERE id = $1', [orgId]),
      );
      if (!org) throw new NotFoundException('Organization not found');

      const limits = await withIdentity((c) =>
        queryOne<UsageLimitRow>(c, 'SELECT * FROM usage_limits WHERE plan_code = $1', [
          org.plan_code,
        ]),
      );
      if (!limits) throw new Error(`Missing usage_limits for plan ${org.plan_code}`);

      const sub = await queryOne<SubscriptionRow>(
        client,
        'SELECT * FROM subscriptions WHERE org_id = $1',
        [orgId],
      );

      const seats = await withIdentity((c) =>
        queryOne<{ count: string }>(
          c,
          `SELECT count(*)::text AS count FROM org_memberships
           WHERE org_id = $1 AND status IN ('active', 'invited')`,
          [orgId],
        ),
      );

      const docs = await queryOne<{ count: string; bytes: string }>(
        client,
        `SELECT count(*)::text AS count, coalesce(sum(byte_size), 0)::text AS bytes
         FROM documents WHERE deleted_at IS NULL`,
        [],
      );

      const ai = await queryOne<{ used: string }>(
        client,
        `SELECT coalesce(sum(request_count), 0)::text AS used
         FROM ai_usage_daily
         WHERE day >= date_trunc('month', current_date)::date`,
        [],
      );

      return {
        planCode: org.plan_code,
        status: org.status,
        trialEndsAt: sub?.trial_ends_at?.toISOString() ?? null,
        seats: { used: Number(seats?.count ?? 0), limit: limits.max_users },
        documents: { used: Number(docs?.count ?? 0), limit: limits.max_documents },
        storageBytes: {
          used: Number(docs?.bytes ?? 0),
          limit: Number(limits.max_storage_bytes),
        },
        aiRequestsThisMonth: {
          used: Number(ai?.used ?? 0),
          limit: limits.max_ai_requests_month,
        },
      };
    });
  }
}
