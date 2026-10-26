// Session helpers shared by the login route, /api/me, /api/logout and proxy.ts.
// Uses the Web Crypto API so it works in both the Node and Edge runtimes.

export const SESSION_COOKIE = "pagasa_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours, in seconds

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const b64 =
    str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

/** Constant-time string comparison (does not leak where the strings differ). */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/** Creates a signed session token: base64url(payload).signature */
export async function createSessionToken(secret: string, username: string): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })
    )
  );
  const signature = await sign(secret, payload);
  return `${payload}.${signature}`;
}

/** Returns the username inside a valid, unexpired token, otherwise null. */
export async function getSessionUsername(
  token: string | undefined,
  secret: string | undefined
): Promise<string | null> {
  if (!token || !secret) return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = await sign(secret, payload);
  if (!safeEqual(signature, expected)) return null;

  try {
    const data = JSON.parse(decoder.decode(fromBase64Url(payload)));
    if (typeof data?.u !== "string" || typeof data?.exp !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data.u;
  } catch {
    return null;
  }
}

/** True when the token is valid and unexpired. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined
): Promise<boolean> {
  return (await getSessionUsername(token, secret)) !== null;
}