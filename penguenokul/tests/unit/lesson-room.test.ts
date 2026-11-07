import { describe, expect, it } from "vitest";
import { isJoinable, joinWindow } from "@/lib/lesson-room";

const start = new Date("2026-11-06T10:00:00Z");

describe("ders odası giriş penceresi", () => {
  it("pencere: başlamadan 15 dk önce açılır, bitişten 30 dk sonra kapanır", () => {
    const w = joinWindow(start, 60, 15);
    expect(w.opensAt.toISOString()).toBe("2026-11-06T09:45:00.000Z");
    expect(w.closesAt.toISOString()).toBe("2026-11-06T11:30:00.000Z");
  });
  it("pencere dışında girilemez, içinde girilir", () => {
    expect(isJoinable(new Date("2026-11-06T09:44:59Z"), start, 60, 15)).toBe(false);
    expect(isJoinable(new Date("2026-11-06T09:45:00Z"), start, 60, 15)).toBe(true);
    expect(isJoinable(new Date("2026-11-06T11:30:00Z"), start, 60, 15)).toBe(true);
    expect(isJoinable(new Date("2026-11-06T11:30:01Z"), start, 60, 15)).toBe(false);
  });
});
