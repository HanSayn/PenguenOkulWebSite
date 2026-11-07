import { describe, expect, it } from "vitest";
import { addDays, istanbulDate, toHHMM, toMinutes, weekdayOf, ymdIstanbul } from "@/lib/format";

describe("İstanbul saat dilimi yardımcıları", () => {
  it("UTC gece yarısına yakın an, İstanbul'da ertesi güne düşer", () => {
    expect(ymdIstanbul(new Date("2026-11-05T22:30:00Z"))).toBe("2026-11-06");
  });
  it("istanbulDate UTC+3 olarak yorumlar", () => {
    expect(istanbulDate("2026-11-06", "09:30").toISOString()).toBe("2026-11-06T06:30:00.000Z");
  });
  it("addDays ay ve yıl sınırını geçer", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("weekdayOf pazar=0", () => {
    expect(weekdayOf("2026-11-08")).toBe(0);
    expect(weekdayOf("2026-11-06")).toBe(5);
  });
  it("dakika dönüşümleri gidiş-dönüş tutarlı", () => {
    expect(toMinutes("10:30")).toBe(630);
    expect(toHHMM(630)).toBe("10:30");
  });
});
