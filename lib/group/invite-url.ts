const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildInviteUrl(code: string, origin: string): string {
  return `${origin}/invite/${code}`;
}

export function extractInviteCode(code: string): string | null {
  return UUID_RE.test(code) ? code : null;
}
