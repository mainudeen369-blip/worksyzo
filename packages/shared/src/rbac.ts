/**
 * Single source of truth for roles and capabilities.
 *
 * The AI tool layer and the HTTP layer both resolve permissions through
 * `can()`. There must never be a second, divergent permission table.
 */

export const ORG_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Higher rank implies every capability of the lower ranks. */
export const ROLE_RANK: Record<OrgRole, number> = {
  owner: 50,
  admin: 40,
  manager: 30,
  member: 20,
  viewer: 10,
};

export const PERMISSIONS = [
  'org:read',
  'org:update',
  'org:delete',
  'billing:manage',
  'member:read',
  'member:invite',
  'member:update_role',
  'member:remove',
  'audit:read',
  'usage:read',
  'document:read',
  'document:create',
  'document:delete',
  'memory:read',
  'memory:create',
  'memory:update',
  'memory:delete',
  'project:read',
  'project:create',
  'project:update',
  'task:read',
  'task:create',
  'task:update_any',
  'ai:chat',
  'ai:act',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Minimum role rank required for each permission. */
const REQUIRED_RANK: Record<Permission, number> = {
  'org:read': ROLE_RANK.viewer,
  'org:update': ROLE_RANK.admin,
  'org:delete': ROLE_RANK.owner,
  'billing:manage': ROLE_RANK.owner,
  'member:read': ROLE_RANK.member,
  'member:invite': ROLE_RANK.admin,
  'member:update_role': ROLE_RANK.admin,
  'member:remove': ROLE_RANK.admin,
  'audit:read': ROLE_RANK.admin,
  'usage:read': ROLE_RANK.admin,
  'document:read': ROLE_RANK.viewer,
  'document:create': ROLE_RANK.member,
  'document:delete': ROLE_RANK.manager,
  'memory:read': ROLE_RANK.viewer,
  'memory:create': ROLE_RANK.member,
  'memory:update': ROLE_RANK.member,
  'memory:delete': ROLE_RANK.manager,
  'project:read': ROLE_RANK.viewer,
  'project:create': ROLE_RANK.manager,
  'project:update': ROLE_RANK.manager,
  'task:read': ROLE_RANK.viewer,
  'task:create': ROLE_RANK.member,
  'task:update_any': ROLE_RANK.manager,
  'ai:chat': ROLE_RANK.viewer,
  // Viewers may ask, but may never mutate through the agent.
  'ai:act': ROLE_RANK.member,
};

export function can(role: OrgRole, permission: Permission): boolean {
  return ROLE_RANK[role] >= REQUIRED_RANK[permission];
}

export function isAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Roles an actor is allowed to grant. Nobody may grant at or above themselves. */
export function assignableRoles(actor: OrgRole): OrgRole[] {
  if (actor === 'owner') return ['admin', 'manager', 'member', 'viewer'];
  if (actor === 'admin') return ['manager', 'member', 'viewer'];
  return [];
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Full control including billing and deleting the organization.',
  admin: 'Manages people, content and settings. No billing deletion.',
  manager: 'Runs projects and tasks, curates documents and memory.',
  member: 'Does the work: creates tasks, notes and asks the AI.',
  viewer: 'Read-only access and AI questions. Cannot change anything.',
};
