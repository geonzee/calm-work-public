/**
 * A setup code carries what a second device needs to join the same SuperSync
 * account: the server address, the access token and the encryption password.
 * Format: `calmsync1.` + base64url(JSON {u, t, k}). It is typed or pasted once
 * per device and never written to git or logs.
 */
export interface CalmSyncCredentials {
  baseUrl: string;
  accessToken: string;
  encryptKey: string;
}

const PREFIX = 'calmsync1.';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeCalmSyncCode(credentials: CalmSyncCredentials): string {
  return (
    PREFIX +
    toBase64Url(
      JSON.stringify({
        u: credentials.baseUrl,
        t: credentials.accessToken,
        k: credentials.encryptKey,
      }),
    )
  );
}

export function parseCalmSyncCode(raw: unknown): CalmSyncCredentials {
  const text = String(raw ?? '').replace(/\s+/g, '');
  if (!text.startsWith(PREFIX)) throw new Error('This is not a Calm Work setup code.');
  let value: { u?: unknown; t?: unknown; k?: unknown };
  try {
    value = JSON.parse(fromBase64Url(text.slice(PREFIX.length)));
  } catch {
    throw new Error('The setup code is damaged. Copy it again.');
  }
  const baseUrl = String(value.u ?? '')
    .trim()
    .replace(/\/+$/, '');
  const accessToken = String(value.t ?? '').trim();
  const encryptKey = String(value.k ?? '');
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('The setup code has no valid server address.');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')
    throw new Error('The sync server must use https.');
  if (accessToken.length < 20) throw new Error('The setup code has no access token.');
  if (encryptKey.length < 8) throw new Error('The setup code has no encryption password.');
  return { baseUrl: url.origin, accessToken, encryptKey };
}
