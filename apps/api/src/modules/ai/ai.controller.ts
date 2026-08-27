import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { chatSchema } from '@worksyzo/shared';
import { RequirePermission, Tenant, type TenantScope } from '../../common/decorators';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SessionGuard } from '../../common/guards/session.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { MembershipService } from '../orgs/membership.service';
import { AiService } from './ai.service';

@Controller('orgs/:orgId/ai')
@UseGuards(SessionGuard, OrgGuard, PermissionGuard)
export class AiController {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(MembershipService) private readonly memberships: MembershipService,
  ) {}

  @Post('chat')
  @RequirePermission('ai:chat')
  async chat(
    @Tenant() tenant: TenantScope,
    @Body(new ZodValidationPipe(chatSchema)) body: ReturnType<typeof chatSchema.parse>,
  ) {
    const membership = await this.memberships.findActive(tenant.orgId, tenant.userId);
    const orgName = membership?.orgName ?? 'Organization';
    return this.ai.chat(tenant.orgId, tenant.userId, orgName, tenant.role, body);
  }
}
