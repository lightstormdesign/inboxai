import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

// ─── Token encryption (AES-256-GCM) ────────────────────────────────────
// Format: v1.<keyId>.<iv b64url>.<tag b64url>.<ciphertext b64url>

function loadKey(b64: string | undefined): Buffer | null {
  if (!b64) return null;
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("Encryption keys must be 32 bytes (base64-encoded)");
  return key;
}

function keyId(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 8);
}

function keys() {
  const current = loadKey(process.env.TOKEN_ENCRYPTION_KEY);
  if (!current) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const previous = loadKey(process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS);
  return { current, all: [current, ...(previous ? [previous] : [])] };
}

export function encryptSecret(plaintext: string): string {
  const { current } = keys();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", current, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", keyId(current), iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, kid, ivB64, tagB64, ctB64] = payload.split(".");
  if (version !== "v1" || !kid || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error("Malformed encrypted secret");
  }
  const key = keys().all.find((k) => keyId(k) === kid);
  if (!key) throw new Error("No encryption key available for this secret (was the key rotated out?)");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

// ─── Passwords (scrypt) ────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length);
  return timingSafeEqual(expected, actual);
}

// ─── Misc helpers ──────────────────────────────────────────────────────

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256(secret: string, data: string | Buffer, encoding: "hex" | "base64url" = "hex"): string {
  return createHmac("sha256", secret).update(data).digest(encoding);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Sign a small JSON payload (used for OAuth `state`). */
export function signPayload(secret: string, payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmacSha256(secret, body, "base64url")}`;
}

export function verifyPayload<T>(secret: string, token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmacSha256(secret, body, "base64url"))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
