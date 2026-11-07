import { describe, expect, it } from "vitest";
import { parseTLToKurus } from "@/lib/money";
import { formatTL } from "@/lib/format";

describe("parseTLToKurus", () => {
  it.each([
    ["2.400,50", 240050],
    ["2400,5", 240050],
    ["2400.50", 240050],
    ["2400", 240000],
    ["₺1.250,50", 125050],
    [" 99 TL ", 9900],
  ])("%s → %i kuruş", (input, expected) => {
    expect(parseTLToKurus(input)).toBe(expected);
  });

  it.each(["", "abc", "0", "-5", "12,345", "1.000.000.01", "1000000,01"])("geçersiz: %j", (input) => {
    expect(parseTLToKurus(input)).toBeNull();
  });
});

describe("formatTL", () => {
  const norm = (s: string) => s.replace(/ /g, " ");
  it("tam liralarda kuruş göstermez", () => {
    expect(norm(formatTL(24000))).toBe("₺240");
  });
  it("kuruşu yuvarlamaz", () => {
    expect(norm(formatTL(125050))).toBe("₺1.250,50");
    expect(norm(formatTL(5))).toBe("₺0,05");
  });
});
