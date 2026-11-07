import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type RateResult = { ok: boolean; retryAfterSec: number };

// Sabit pencereli sayaç. Tüm geçişler koşullu güncellemeyle yapılır, eşzamanlı isteklerde sayaç şaşmaz.
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date();

    // 1) Pencere açık ve limit dolmadı: say
    const inc = await prisma.rateLimit.updateMany({
      where: { key, resetAt: { gt: now }, count: { lt: limit } },
      data: { count: { increment: 1 } },
    });
    if (inc.count === 1) return { ok: true, retryAfterSec: 0 };

    const row = await prisma.rateLimit.findUnique({ where: { key } });
    const resetAt = new Date(now.getTime() + windowSec * 1000);

    // 2) Kayıt yok: oluştur (eşzamanlı oluşturma çakışırsa döngü tekrar dener)
    if (!row) {
      try {
        await prisma.rateLimit.create({ data: { key, count: 1, resetAt } });
        return { ok: true, retryAfterSec: 0 };
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") continue;
        throw err;
      }
    }

    // 3) Pencere bitti: sıfırla
    if (row.resetAt <= now) {
      const reset = await prisma.rateLimit.updateMany({
        where: { key, resetAt: { lte: now } },
        data: { count: 1, resetAt },
      });
      if (reset.count === 1) return { ok: true, retryAfterSec: 0 };
      continue;
    }

    // 4) Pencere açık ve limit dolu
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)) };
  }
  // Üst üste çakışma: güvenli tarafta kal
  return { ok: false, retryAfterSec: 1 };
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

export async function purgeExpiredRateLimits(now = new Date()): Promise<number> {
  return (await prisma.rateLimit.deleteMany({ where: { resetAt: { lte: now } } })).count;
}

// Ters vekil (nginx, Vercel vb.) arkasında istemci adresi x-forwarded-for'dan okunur.
// Doğrudan internete açık kurulumda bu başlık sahte olabilir; vekilin başlığı üzerine yazdığından emin ol.
export function ipFromHeaders(h: Pick<Headers, "get">): string {
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || h.get("x-real-ip") || "bilinmiyor").slice(0, 64);
}

export function clientIp(): string {
  return ipFromHeaders(headers());
}

export function waitText(sec: number): string {
  return sec < 90 ? `${sec} saniye` : `${Math.ceil(sec / 60)} dakika`;
}
