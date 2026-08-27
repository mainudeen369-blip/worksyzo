import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  generateToken,
  hashPassword,
  hashToken,
  queryOne,
  queryRows,
  withIdentity,
  withIdentityTransaction,
  type MembershipRow,
  type OrganizationRow,
  type UserRow,
} from '@worksyzo/db';
import {
  AUDIT_ACTIONS,
  assignableRoles,
  can,
  type AcceptInviteInput,
  type InviteMemberInput,
  type MemberView,
  type OrgRole,
} from '@worksyzo/shared';
import { AuditService } from '../audit/audit.service';
import { config } from '../../config';

export interface ActiveMembership {
  membershipId: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  orgStatus: OrganizationRow['status'];
  orgName: string;
}

@Injectable()
export class MembershipService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async findActive(orgId: string, userId: string): Promise<ActiveMembership | null> {
    const row = await withIdentity((c) =>
      queryOne<MembershipRow & { org_status: OrganizationRow['status']; org_name: string }>(
        c,
        `SELECT m.*, o.status AS org_status, o.name AS org_name
         FROM org_memberships m
         JOIN organizations o ON o.id = m.org_id
         WHERE m.org_id = $1 AND m.user_id = $2 AND m.status = 'active' AND o.deleted_at IS NULL`,
        [orgId, userId],
      ),
    );
    if (!row) return null;
    return {
      membershipId: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      role: row.role,
      orgStatus: row.org_status,
      orgName: row.org_name,
    };
  }

  async listMembers(orgId: string, _actorUserId: string): Promise<MemberView[]> {
    const rows = await withIdentity((c) =>
      queryRows<MembershipRow & { email: string; name: string; last_login_at: Date | null }>(
        c,
        `SELECT m.*, u.email, u.name, u.last_login_at
         FROM org_memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.org_id = $1
         ORDER BY
           CASE m.role
             WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3
             WHEN 'member' THEN 4 ELSE 5
           END,
           u.name ASC`,
        [orgId],
      ),
    );

    return rows.map((r) => ({
      userId: r.user_id,
      membershipId: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      lastLoginAt: r.last_login_at?.toISOString() ?? null,
    }));
  }

  async invite(
    orgId: string,
    actor: { userId: string; role: OrgRole },
    input: InviteMemberInput,
  ): Promise<{ inviteToken: string; member: MemberView }> {
    if (!can(actor.role, 'member:invite')) {
      throw new ForbiddenException('You cannot invite members');
    }
    if (!assignableRoles(actor.role).includes(input.role)) {
      throw new ForbiddenException(`You cannot assign the role "${input.role}"`);
    }
    if (input.role === 'owner') {
      throw new BadRequestException('Ownership transfer is a separate action');
    }

    const inviteToken = generateToken('inv', 24);
    const inviteHash = hashToken(inviteToken);
    const expiresAt = new Date(Date.now() + config.invites.ttlDays * 24 * 60 * 60 * 1000);

    const result = await withIdentityTransaction(async (client) => {
      let user = await queryOne<UserRow>(
        client,
        'SELECT * FROM users WHERE lower(email) = lower($1)',
        [input.email],
      );

      if (!user) {
        user = await queryOne<UserRow>(
          client,
          `INSERT INTO users (email, name, password_hash)
           VALUES ($1, $2, NULL)
           RETURNING *`,
          [input.email, input.name?.trim() || input.email.split('@')[0]],
        );
      }
      if (!user) throw new Error('Failed to resolve invitee');

      const existing = await queryOne<MembershipRow>(
        client,
        'SELECT * FROM org_memberships WHERE org_id = $1 AND user_id = $2',
        [orgId, user.id],
      );
      if (existing?.status === 'active') {
        throw new ConflictException('This person is already a member of the organization');
      }

      let membership: MembershipRow | null;
      if (existing) {
        membership = await queryOne<MembershipRow>(
          client,
          `UPDATE org_memberships
           SET role = $2, status = 'invited', invited_by = $3,
               invite_token_hash = $4, invite_expires_at = $5, updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [existing.id, input.role, actor.userId, inviteHash, expiresAt.toISOString()],
        );
      } else {
        membership = await queryOne<MembershipRow>(
          client,
          `INSERT INTO org_memberships
             (org_id, user_id, role, status, invited_by, invite_token_hash, invite_expires_at)
           VALUES ($1, $2, $3, 'invited', $4, $5, $6)
           RETURNING *`,
          [orgId, user.id, input.role, actor.userId, inviteHash, expiresAt.toISOString()],
        );
      }
      if (!membership) throw new Error('Failed to create invite');
      return { user, membership };
    });

    await this.audit.write({
      orgId,
      actorUserId: actor.userId,
      action: AUDIT_ACTIONS.memberInvited,
      resourceType: 'membership',
      resourceId: result.membership.id,
      metadata: { email: input.email, role: input.role },
    });

    return {
      inviteToken,
      member: {
        userId: result.user.id,
        membershipId: result.membership.id,
        email: result.user.email,
        name: result.user.name,
        role: result.membership.role,
        status: result.membership.status,
        createdAt: result.membership.created_at.toISOString(),
        lastLoginAt: result.user.last_login_at?.toISOString() ?? null,
      },
    };
  }

  async acceptInvite(input: AcceptInviteInput): Promise<{ userId: string; orgId: string }> {
    const tokenHash = hashToken(input.token);
    const passwordHash = await hashPassword(input.password);

    const accepted = await withIdentityTransaction(async (client) => {
      const membership = await queryOne<MembershipRow>(
        client,
        `SELECT * FROM org_memberships
         WHERE invite_token_hash = $1
           AND status = 'invited'
           AND invite_expires_at > now()`,
        [tokenHash],
      );
      if (!membership) {
        throw new NotFoundException('This invite is invalid or has expired');
      }

      await client.query(
        `UPDATE users
         SET password_hash = $2,
             name = COALESCE(NULLIF($3, ''), name),
             updated_at = now()
         WHERE id = $1`,
        [membership.user_id, passwordHash, input.name ?? null],
      );

      await client.query(
        `UPDATE org_memberships
         SET status = 'active', joined_at = now(),
             invite_token_hash = NULL, invite_expires_at = NULL, updated_at = now()
         WHERE id = $1`,
        [membership.id],
      );

      return {
        userId: membership.user_id,
        orgId: membership.org_id,
        membershipId: membership.id,
      };
    });

    await this.audit.write({
      orgId: accepted.orgId,
      actorUserId: accepted.userId,
      action: AUDIT_ACTIONS.memberJoined,
      resourceType: 'membership',
      resourceId: accepted.membershipId,
    });

    return { userId: accepted.userId, orgId: accepted.orgId };
  }

  async updateRole(
    orgId: string,
    actor: { userId: string; role: OrgRole },
    targetUserId: string,
    newRole: OrgRole,
  ): Promise<void> {
    if (!can(actor.role, 'member:update_role')) {
      throw new ForbiddenException('You cannot change roles');
    }
    if (newRole === 'owner') {
      throw new BadRequestException('Ownership transfer is a separate action');
    }
    if (!assignableRoles(actor.role).includes(newRole)) {
      throw new ForbiddenException(`You cannot assign the role "${newRole}"`);
    }
    if (targetUserId === actor.userId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const target = await withIdentity((c) =>
      queryOne<MembershipRow>(
        c,
        'SELECT * FROM org_memberships WHERE org_id = $1 AND user_id = $2',
        [orgId, targetUserId],
      ),
    );
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') {
      throw new ForbiddenException('The owner role cannot be changed this way');
    }
    if (!assignableRoles(actor.role).includes(target.role)) {
      throw new ForbiddenException('You cannot change a member at or above your level');
    }

    await withIdentity((c) =>
      c.query('UPDATE org_memberships SET role = $2, updated_at = now() WHERE id = $1', [
        target.id,
        newRole,
      ]),
    );

    await this.audit.write({
      orgId,
      actorUserId: actor.userId,
      action: AUDIT_ACTIONS.memberRoleChanged,
      resourceType: 'membership',
      resourceId: target.id,
      metadata: { from: target.role, to: newRole, targetUserId },
    });
  }

  async remove(
    orgId: string,
    actor: { userId: string; role: OrgRole },
    targetUserId: string,
  ): Promise<void> {
    if (!can(actor.role, 'member:remove')) {
      throw new ForbiddenException('You cannot remove members');
    }
    if (targetUserId === actor.userId) {
      throw new BadRequestException('You cannot remove yourself');
    }

    const target = await withIdentity((c) =>
      queryOne<MembershipRow>(
        c,
        'SELECT * FROM org_memberships WHERE org_id = $1 AND user_id = $2',
        [orgId, targetUserId],
      ),
    );
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') {
      throw new ForbiddenException('The owner cannot be removed');
    }
    if (!assignableRoles(actor.role).includes(target.role)) {
      throw new ForbiddenException('You cannot remove a member at or above your level');
    }

    await withIdentity((c) =>
      c.query(
        `UPDATE org_memberships
         SET status = 'disabled', invite_token_hash = NULL, updated_at = now()
         WHERE id = $1`,
        [target.id],
      ),
    );

    await this.audit.write({
      orgId,
      actorUserId: actor.userId,
      action: AUDIT_ACTIONS.memberRemoved,
      resourceType: 'membership',
      resourceId: target.id,
      metadata: { targetUserId, previousRole: target.role },
    });
  }
}
