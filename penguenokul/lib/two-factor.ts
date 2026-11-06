import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

export const ISSUER = "Penguen Okul";

export function newTotpSecret(): string {
  return generateSecret();
}

export function totpUri(accountLabel: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: accountLabel, secret });
}

// 6 haneli kod; ±30 sn saat sapmasına izin verilir
export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  const code = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const result = await verify({ secret, token: code, epochTolerance: 30 });
  return result.valid === true;
}

export function qrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { margin: 1, width: 220 });
}
