export interface NavTarget {
  href: string;
  label: string;
}

/** Routes the assistant can open by voice or typed command. */
export const ASSISTANT_NAV_TARGETS: NavTarget[] = [
  { href: '/app', label: 'home' },
  { href: '/app/chat', label: 'chat' },
  { href: '/app/documents', label: 'documents' },
  { href: '/app/members', label: 'team' },
  { href: '/app/face-id', label: 'face id' },
  { href: '/app/audit', label: 'audit' },
  { href: '/app/usage', label: 'usage' },
  { href: '/app/blueprint', label: 'roadmap' },
];

const NAV_PATTERNS: { pattern: RegExp; href: string; reply: string }[] = [
  {
    pattern: /\b(?:open|go to|show|take me to)\s+(?:the\s+)?(?:home|dashboard)\b/i,
    href: '/app',
    reply: 'Opening your home dashboard.',
  },
  {
    pattern: /\b(?:open|go to|show|take me to)\s+(?:the\s+)?(?:ai\s+)?chat\b/i,
    href: '/app/chat',
    reply: 'Opening AI chat.',
  },
  {
    pattern: /\b(?:open|go to|show|take me to|upload)\s+(?:the\s+)?documents?\b/i,
    href: '/app/documents',
    reply: 'Opening documents. You can upload policies and SOPs here.',
  },
  {
    pattern: /\b(?:open|go to|show|take me to)\s+(?:the\s+)?(?:team|members?|people|roles?)\b/i,
    href: '/app/members',
    reply: 'Opening team and roles.',
  },
  {
    pattern: /\b(?:open|go to|show|take me to)\s+(?:the\s+)?(?:face\s*id|biometrics?)\b/i,
    href: '/app/face-id',
    reply: 'Opening Face ID settings.',
  },
  {
    pattern: /\b(?:open|go to|show|take me to)\s+(?:the\s+)?audit(?:\s+log)?\b/i,
    href: '/app/audit',
    reply: 'Opening the audit log.',
  },
  {
    pattern: /\b(?:open|go to|show|take me to)\s+(?:the\s+)?usage(?:\s+(?:and\s+)?quota)?\b/i,
    href: '/app/usage',
    reply: 'Opening usage and quota.',
  },
  {
    pattern: /\b(?:open|go to|show|take me to)\s+(?:the\s+)?(?:roadmap|blueprint|specs?)\b/i,
    href: '/app/blueprint',
    reply: 'Opening the product roadmap.',
  },
];

export function matchNavCommand(message: string): { href: string; reply: string } | null {
  const trimmed = message.trim();
  for (const item of NAV_PATTERNS) {
    if (item.pattern.test(trimmed)) {
      return { href: item.href, reply: item.reply };
    }
  }
  return null;
}

export function pageLabelFromPath(pathname: string): string {
  const hit = ASSISTANT_NAV_TARGETS.find((t) => t.href === pathname);
  if (hit) return hit.label;
  if (pathname.startsWith('/app/chat')) return 'chat';
  if (pathname.startsWith('/app/documents')) return 'documents';
  return 'workspace';
}
