import type {
  DocumentStatus,
  MembershipStatus,
  MemoryType,
  OrgRole,
  OrgStatus,
  TaskPriority,
  TaskSource,
  TaskStatus,
  Visibility,
} from '@worksyzo/shared';

/** Row shapes returned by pg (snake_case, dates as Date, bigint as string). */

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  ip: string | null;
  user_agent: string | null;
  created_at: Date;
  last_seen_at: Date;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  plan_code: string;
  status: OrgStatus;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface MembershipRow {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  status: MembershipStatus;
  invited_by: string | null;
  invite_token_hash: string | null;
  invite_expires_at: Date | null;
  joined_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UsageLimitRow {
  plan_code: string;
  display_name: string;
  price_inr_monthly: number;
  max_users: number;
  max_documents: number;
  max_storage_bytes: string;
  max_ai_requests_month: number;
  sort_order: number;
}

export interface DocumentRow {
  id: string;
  org_id: string;
  title: string;
  source_type: string;
  mime_type: string;
  storage_key: string;
  byte_size: string;
  checksum: string | null;
  status: DocumentStatus;
  error: string | null;
  visibility: Visibility;
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface DocumentChunkRow {
  id: string;
  org_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  embedding_text?: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface MemoryRow {
  id: string;
  org_id: string;
  type: MemoryType;
  title: string;
  body: string;
  occurred_at: Date | null;
  visibility: Visibility;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  owner_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface TaskRow {
  id: string;
  org_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_user_id: string | null;
  due_at: Date | null;
  created_by: string;
  source: TaskSource;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface AuditEventRow {
  id: string;
  org_id: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface SubscriptionRow {
  id: string;
  org_id: string;
  plan_code: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled';
  razorpay_subscription_id: string | null;
  trial_ends_at: Date | null;
  current_period_end: Date | null;
  created_at: Date;
  updated_at: Date;
}
