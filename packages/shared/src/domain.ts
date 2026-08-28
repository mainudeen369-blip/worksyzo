import type { OrgRole } from './rbac';

export type MembershipStatus = 'invited' | 'active' | 'disabled';
export type OrgStatus = 'trial' | 'active' | 'suspended';
export type Visibility = 'org' | 'restricted';

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type MemoryType = 'decision' | 'note' | 'meeting' | 'conversation_summary';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskSource = 'ui' | 'ai';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  planCode: string;
  status: OrgStatus;
  role: OrgRole;
}

export interface SessionResponse {
  user: PublicUser;
  organizations: OrgSummary[];
}

export interface MemberView {
  userId: string;
  membershipId: string;
  email: string;
  name: string;
  role: OrgRole;
  status: MembershipStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuditEventView {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface UsageSnapshot {
  planCode: string;
  status: OrgStatus;
  trialEndsAt: string | null;
  seats: { used: number; limit: number };
  documents: { used: number; limit: number };
  storageBytes: { used: number; limit: number };
  aiRequestsThisMonth: { used: number; limit: number };
}

export interface DocumentView {
  id: string;
  title: string;
  mimeType: string;
  byteSize: number;
  status: DocumentStatus;
  error: string | null;
  visibility: Visibility;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunkView {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  charCount: number;
  embeddingDimensions: number;
  embeddingPreview: number[];
  createdAt: string;
}

export interface DocumentPipelineStage {
  stage: 'extract' | 'chunk' | 'embed' | 'index';
  name: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
  details?: string;
}

export interface DocumentInspectView {
  document: DocumentView;
  totalChunks: number;
  totalTokens: number;
  totalCharacters: number;
  averageTokensPerChunk: number;
  embeddingModel: string;
  vectorDimensions: number;
  pipelineStages: DocumentPipelineStage[];
  chunks: DocumentChunkView[];
}

export interface CitationView {
  documentId: string;
  title: string;
  chunkIndex: number;
  excerpt: string;
  score?: number;
}

export interface ChatResponseView {
  conversationId: string;
  messageId: string;
  answer: string;
  citations: CitationView[];
}

export interface FaceChallengeResponse {
  challengeId: string;
  challengeType: 'smile' | 'blink' | 'surprise' | 'neutral';
  instruction: string;
  expiresInSeconds: number;
}

export interface FaceCredentialStatus {
  enrolled: boolean;
  registeredExpression?: string;
  createdAt?: string;
  lastUsedAt?: string | null;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  requestId?: string;
}

/** Canonical audit action names. Keep in sync with what the API writes. */
export const AUDIT_ACTIONS = {
  userRegistered: 'user.registered',
  userLogin: 'user.login',
  userLoginFailed: 'user.login_failed',
  userLogout: 'user.logout',
  userFaceRegistered: 'user.face_registered',
  userFaceLogin: 'user.face_login',
  userFaceLoginFailed: 'user.face_login_failed',
  orgCreated: 'org.created',
  orgUpdated: 'org.updated',
  memberInvited: 'member.invited',
  memberJoined: 'member.joined',
  memberRoleChanged: 'member.role_changed',
  memberRemoved: 'member.removed',
  documentUploaded: 'document.uploaded',
  documentDeleted: 'document.deleted',
  memoryCreated: 'memory.created',
  taskCreated: 'task.created',
  taskUpdated: 'task.updated',
  aiChat: 'ai.chat',
  aiToolInvoked: 'ai.tool_invoked',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
