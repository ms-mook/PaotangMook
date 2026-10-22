// HMAC-signed session cookie — works in both Node and the proxy runtime (Web Crypto only).
export const SESSION_COOKIE = "pt_session";
export const SESSION_DAYS = 90;

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  let bin = "";
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSession(): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const payload = `v1.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const exp = Number(payload.split(".")[1]);
  if (!exp || exp < Date.now()) return false;
  const expected = await hmac(payload);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let k = 0; k < sig.length; k++) diff |= sig.charCodeAt(k) ^ expected.charCodeAt(k);
  return diff === 0;
}
