import { beforeEach, describe, expect, it, vi } from "vitest";

// Veritabanı yerine bellekte çalışan sahte sayaç tablosu: algoritmanın dallarını sınar.
type Row = { key: string; count: number; resetAt: Date };
const table = new Map<string, Row>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimit: {
      updateMany: async ({ where, data }: any) => {
        const r = table.get(where.key);
        if (!r) return { count: 0 };
        if (where.resetAt?.gt && !(r.resetAt > where.resetAt.gt)) return { count: 0 };
        if (where.resetAt?.lte && !(r.resetAt <= where.resetAt.lte)) return { count: 0 };
        if (where.count?.lt !== undefined && !(r.count < where.count.lt)) return { count: 0 };
        if (data.count?.increment) r.count += data.count.increment;
        else Object.assign(r, data);
        return { count: 1 };
      },
      findUnique: async ({ where }: any) => table.get(where.key) ?? null,
      create: async ({ data }: any) => {
        if (table.has(data.key)) throw Object.assign(new Error("dup"), { code: "P2002" });
        table.set(data.key, { ...data });
        return data;
      },
      deleteMany: async ({ where }: any) => {
        let n = 0;
        for (const [k, r] of [...table]) {
          if ((where.key && k === where.key) || (where.resetAt?.lte && r.resetAt <= where.resetAt.lte)) { table.delete(k); n++; }
        }
        return { count: n };
      },
    },
  },
}));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));

import { ipFromHeaders, purgeExpiredRateLimits, rateLimit, resetRateLimit, waitText } from "@/lib/rate-limit";

beforeEach(() => table.clear());

describe("rateLimit", () => {
  it("limite kadar geçirir, sonra engeller ve bekleme süresi verir", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("k", 3, 60));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSec).toBeGreaterThan(0);
  });
  it("anahtarlar birbirinden bağımsızdır", async () => {
    await rateLimit("a", 1, 60);
    expect((await rateLimit("a", 1, 60)).ok).toBe(false);
    expect((await rateLimit("b", 1, 60)).ok).toBe(true);
  });
  it("pencere bitince sayaç yeniden başlar", async () => {
    await rateLimit("k", 1, 60);
    table.get("k")!.resetAt = new Date(Date.now() - 1);
    expect((await rateLimit("k", 1, 60)).ok).toBe(true);
    expect(table.get("k")!.count).toBe(1);
  });
  it("resetRateLimit sayacı siler", async () => {
    await rateLimit("k", 1, 60);
    await resetRateLimit("k");
    expect((await rateLimit("k", 1, 60)).ok).toBe(true);
  });
  it("süresi dolanları temizler", async () => {
    await rateLimit("eski", 1, 60);
    await rateLimit("yeni", 1, 60);
    table.get("eski")!.resetAt = new Date(Date.now() - 1);
    expect(await purgeExpiredRateLimits()).toBe(1);
    expect(table.has("yeni")).toBe(true);
  });
});

describe("yardımcılar", () => {
  it("x-forwarded-for'un ilk adresini alır", () => {
    expect(ipFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(ipFromHeaders(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(ipFromHeaders(new Headers())).toBe("bilinmiyor");
  });
  it("bekleme metni", () => {
    expect(waitText(30)).toBe("30 saniye");
    expect(waitText(600)).toBe("10 dakika");
  });
});
