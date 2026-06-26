import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless, signed unsubscribe tokens so the one-click List-Unsubscribe link works
// without a login session. token = base64url(userId) "." base64url(HMAC-SHA256(userId)).
// Signed with AUTH_SECRET, so it can't be forged to unsubscribe someone else.

function sign(userId: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(userId).digest();
}

export function makeUnsubscribeToken(userId: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  const id = Buffer.from(userId).toString("base64url");
  const sig = sign(userId, secret).toString("base64url");
  return `${id}.${sig}`;
}

/** Returns the userId if the token is valid, else null. */
export function verifyUnsubscribeToken(token: string): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let userId: string;
  let provided: Buffer;
  try {
    userId = Buffer.from(parts[0], "base64url").toString("utf8");
    provided = Buffer.from(parts[1], "base64url");
  } catch {
    return null;
  }
  const expected = sign(userId, secret);
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? userId : null;
}
