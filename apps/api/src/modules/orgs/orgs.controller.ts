import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  acceptInviteSchema,
  auditQuerySchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateOrgSchema,
} from '@worksyzo/shared';
import { CurrentUser, RequirePermission, Tenant, type TenantScope } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/request-context';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SessionGuard } from '../../common/guards/session.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { config } from '../../config';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { MembershipService } from './membership.service';
import { OrgsService } from './orgs.service';

@Controller()
export class OrgsController {
  constructor(
    @Inject(OrgsService) private readonly orgs: OrgsService,
    @Inject(MembershipService) private readonly members: MembershipService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Get('orgs/:orgId')
  @UseGuards(SessionGuard, OrgGuard, PermissionGuard)
  @RequirePermission('org:read')
  getOrg(@Tenant() tenant: TenantScope) {
    return this.orgs.get(tenant.orgId, tenant.userId);
  }

  @Patch('orgs/:orgId')
  @UseGuards(SessionGuard, OrgGuard, PermissionGuard)
  @RequirePermission('org:update')
  updateOrg(
    @Tenant() tenant: TenantScope,
    @Body(new ZodValidationPipe(updateOrgSchema)) body: ReturnType<typeof updateOrgSchema.parse>,
  ) {
    return this.orgs.update(tenant.orgId, tenant.userId, body);
  }

  @Get('orgs/:orgId/usage')
  @UseGuards(SessionGuard, OrgGuard, PermissionGuard)
  @RequirePermission('usage:read')
  usage(@Tenant() tenant: TenantScope) {
    return this.orgs.usage(tenant.orgId, tenant.userId);
  }

  @Get('orgs/:orgId/members')
  @UseGuards(SessionGuard, OrgGuard, PermissionGuard)
  @RequirePermission('member:read')
  listMembers(@Tenant() tenant: TenantScope) {
    return this.members.listMembers(tenant.orgId, tenant.userId);
  }

  @Post('orgs/:orgId/members/invite')
  @UseGuards(SessionGuard, OrgGuard, PermissionGuard)
  @RequirePermission('member:invite')
  async invite(
    @Tenant() tenant: TenantScope,
    @Body(new ZodValidationPipe(inviteMemberSchema))
    body: ReturnType<typeof inviteMemberSchema.parse>,
  ) {
    const result = await this.members.invite(
      tenant.orgId,
      { userId: tenant.userId, role: tenant.role },
      body,
    );
    // In production the token is emailed. In development we return it so the
    // invite flow is testable without an email provider.
    return {
      member: result.member,
      inviteToken: config.isProduction ? undefined : result.inviteToken,
      invitePath: config.isProduction ? undefined : `/invite/${result.inviteToken}`,
    };
  }

  @Patch('orgs/:orgId/members/:userId')
  @UseGuards(SessionGuard, OrgGuard, PermissionGuard)
  @RequirePermission('member:update_role')
  @HttpCode(204)
  async updateRole(
    @Tenant() tenant: TenantScope,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema))
    body: ReturnType<typeof updateMemberRoleSchema.parse>,
  ) {
    await this.members.updateRole(
      tenant.orgId,
      { userId: tenant.userId, role: tenant.role },
      userId,
      body.role,
    );
  }

  @Delete('orgs/:orgId/members/:userId')
  @UseGuards(SessionGuard, OrgGuard, PermissionGuard)
  @RequirePermission('member:remove')
  @HttpCode(204)
  async remove(@Tenant() tenant: TenantScope, @Param('userId') userId: string) {
    await this.members.remove(
      tenant.orgId,
      { userId: tenant.userId, role: tenant.role },
      userId,
    );
  }

  @Get('orgs/:orgId/audit')
  @UseGuards(SessionGuard, OrgGuard, PermissionGuard)
  @RequirePermission('audit:read')
  async auditLog(
    @Tenant() tenant: TenantScope,
    @Query(new ZodValidationPipe(auditQuerySchema))
    query: ReturnType<typeof auditQuerySchema.parse>,
  ) {
    return this.audit.list(tenant.orgId, tenant.userId, query);
  }

  /** Public invite acceptance - creates a session on success. */
  @Post('invites/accept')
  async acceptInvite(
    @Body(new ZodValidationPipe(acceptInviteSchema))
    body: ReturnType<typeof acceptInviteSchema.parse>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accepted = await this.members.acceptInvite(body);
    const token = await this.sessions.create(accepted.userId, { ip: null, userAgent: null });
    const crossSite = config.session.secure;
    res.cookie(config.session.cookieName, token, {
      httpOnly: true,
      sameSite: crossSite ? 'none' : 'lax',
      secure: crossSite,
      path: '/',
      maxAge: config.session.ttlDays * 24 * 60 * 60 * 1000,
    });
    return this.auth.buildSession(accepted.userId);
  }
}
