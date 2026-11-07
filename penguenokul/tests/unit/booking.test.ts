import { beforeEach, describe, expect, it, vi } from "vitest";

// Veritabanı yerine sabit müsaitlik ve dolu ders listesi: saat üretme kuralları saf olarak sınanır.
let availability: any[] = [];
let booked: { scheduledAt: Date }[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    availability: { findMany: async () => availability },
    lesson: { findMany: async () => booked },
  },
}));

import { BOOKING_HORIZON_DAYS, MIN_LEAD_HOURS, getOpenSlots, slotKeyFor } from "@/lib/booking";
import { istanbulDate } from "@/lib/format";

// Cuma 6 Kasım 2026, İstanbul saatiyle 09:00
const NOW = new Date("2026-11-06T06:00:00Z");
const fridayRule = { dayOfWeek: 5, specificDate: null, startTime: "10:00", endTime: "13:00", isRecurring: true };
const hhmm = (d: Date) => d.toISOString().slice(11, 16); // UTC; İstanbul = +3

beforeEach(() => {
  availability = [];
  booked = [];
});

describe("getOpenSlots", () => {
  it("müsaitlik yoksa boş döner", async () => {
    expect(await getOpenSlots("t1", NOW)).toEqual([]);
  });

  it("saatlik dilimlere böler, son dilim bitişi aşmaz", async () => {
    availability = [fridayRule];
    const slots = await getOpenSlots("t1", NOW);
    // Gelecek cuma 10:00, 11:00, 12:00 (13:00 dilimi yok)
    const nextFri = slots.filter((s) => s.toISOString().startsWith("2026-11-13"));
    expect(nextFri.map(hhmm)).toEqual(["07:00", "08:00", "09:00"]);
  });

  it(`en erken ${MIN_LEAD_HOURS} saat sonrasına ders verilir`, async () => {
    availability = [fridayRule];
    const slots = await getOpenSlots("t1", NOW);
    const today = slots.filter((s) => s.toISOString().startsWith("2026-11-06"));
    // Şimdi 09:00; en erken 11:00 → bugünden 11:00 ve 12:00 kalır, 10:00 yok
    expect(today.map((s) => hhmm(s))).toEqual(["08:00", "09:00"]);
    expect(slots.every((s) => s.getTime() >= NOW.getTime() + MIN_LEAD_HOURS * 3600_000)).toBe(true);
  });

  it("dolu saat listeden çıkar", async () => {
    availability = [fridayRule];
    booked = [{ scheduledAt: istanbulDate("2026-11-13", "11:00") }];
    const slots = await getOpenSlots("t1", NOW);
    expect(slots.some((s) => s.getTime() === istanbulDate("2026-11-13", "11:00").getTime())).toBe(false);
    expect(slots.some((s) => s.getTime() === istanbulDate("2026-11-13", "12:00").getTime())).toBe(true);
  });

  it("tek seferlik müsaitlik yalnız o güne uygulanır", async () => {
    availability = [{ dayOfWeek: null, specificDate: istanbulDate("2026-11-10", "00:00"), startTime: "14:00", endTime: "16:00", isRecurring: false }];
    const slots = await getOpenSlots("t1", NOW);
    expect(slots.map((s) => s.getTime())).toEqual([istanbulDate("2026-11-10", "14:00").getTime(), istanbulDate("2026-11-10", "15:00").getTime()]);
  });

  it("çakışan iki müsaitlik aynı saati iki kez üretmez", async () => {
    availability = [fridayRule, { ...fridayRule, startTime: "11:00", endTime: "13:00" }];
    const slots = await getOpenSlots("t1", NOW);
    const times = slots.map((s) => s.getTime());
    expect(new Set(times).size).toBe(times.length);
  });

  it(`en fazla ${BOOKING_HORIZON_DAYS} gün ilerisi gösterilir ve sonuç sıralıdır`, async () => {
    availability = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ ...fridayRule, dayOfWeek: d }));
    const slots = await getOpenSlots("t1", NOW);
    const sorted = [...slots].sort((a, b) => a.getTime() - b.getTime());
    expect(slots).toEqual(sorted);
    const limit = istanbulDate("2026-11-20", "00:00").getTime(); // bugün + 14 gün
    expect(slots.every((s) => s.getTime() < limit)).toBe(true);
  });
});

describe("slotKeyFor", () => {
  it("öğretmen ve başlangıç anına göre tekil anahtar üretir", () => {
    const d = new Date("2026-11-13T07:00:00Z");
    expect(slotKeyFor("t1", d)).toBe("t1|2026-11-13T07:00:00.000Z");
    expect(slotKeyFor("t1", d)).not.toBe(slotKeyFor("t2", d));
  });
});
