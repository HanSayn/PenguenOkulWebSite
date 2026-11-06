import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Hassas alanlar (ör. 2FA gizli anahtarı) veritabanında düz metin tutulmaz.
// Anahtar AUTH_SECRET'tan türetilir; AES-256-GCM ile şifrelenir.
function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET tanımlı değil");
  return createHash("sha256").update(secret).digest();
}

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString("base64")).join(".");
}

export function decryptText(payload: string): string {
  const [ivB, tagB, dataB] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]).toString("utf8");
}
