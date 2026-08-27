import { AsyncLocalStorage } from 'node:async_hooks';
import type { OrgRole } from '@worksyzo/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  sessionId: string;
}

export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  user?: AuthenticatedUser;
  orgId?: string;
  role?: OrgRole;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Throws rather than returning a partial context: an authenticated,
 * tenant-scoped operation must never silently run without a tenant.
 */
export function requireTenantContext(): Required<Pick<RequestContext, 'orgId' | 'role'>> &
  RequestContext & { user: AuthenticatedUser } {
  const ctx = getContext();
  if (!ctx?.user || !ctx.orgId || !ctx.role) {
    throw new Error('Tenant context is not available on this request');
  }
  return ctx as Required<Pick<RequestContext, 'orgId' | 'role'>> &
    RequestContext & { user: AuthenticatedUser };
}
