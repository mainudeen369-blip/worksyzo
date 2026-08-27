import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { OrgRole, Permission } from '@worksyzo/shared';
import { requireTenantContext, getContext, type AuthenticatedUser } from './request-context';

export const PERMISSION_KEY = 'worksyzo:permission';

/** Declares the capability a route needs. Enforced by PermissionGuard. */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);

export const CurrentUser = createParamDecorator((_data: unknown, _ctx: ExecutionContext): AuthenticatedUser => {
  const user = getContext()?.user;
  if (!user) throw new Error('CurrentUser used on an unauthenticated route');
  return user;
});

export interface TenantScope {
  orgId: string;
  userId: string;
  role: OrgRole;
}

export const Tenant = createParamDecorator((_data: unknown, _ctx: ExecutionContext): TenantScope => {
  const ctx = requireTenantContext();
  return { orgId: ctx.orgId, userId: ctx.user.id, role: ctx.role };
});
