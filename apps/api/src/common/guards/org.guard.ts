import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getContext } from '../request-context';
import { MembershipService } from '../../modules/orgs/membership.service';

/**
 * Turns the :orgId path parameter into a verified tenant scope.
 *
 * The org id from the URL is never trusted on its own - it is only accepted
 * once an active membership for the authenticated user is found. This is the
 * single place where a request becomes tenant-scoped.
 */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(@Inject(MembershipService) private readonly memberships: MembershipService) {}

  async canActivate(execContext: ExecutionContext): Promise<boolean> {
    const req = execContext.switchToHttp().getRequest<Request>();
    const ctx = getContext();
    if (!ctx?.user) throw new ForbiddenException('Authentication is required');

    const rawOrgId = req.params.orgId;
    const orgId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;
    if (!orgId) throw new NotFoundException('Organization not specified');

    const membership = await this.memberships.findActive(orgId, ctx.user.id);
    // Deliberately 404, not 403: a stranger should not learn that this org exists.
    if (!membership) throw new NotFoundException('Organization not found');
    if (membership.orgStatus === 'suspended') {
      throw new ForbiddenException('This organization is suspended. Contact the owner.');
    }

    ctx.orgId = orgId;
    ctx.role = membership.role;
    return true;
  }
}
