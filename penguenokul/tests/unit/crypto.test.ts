import { describe, expect, it } from "vitest";
import { decryptText, encryptText } from "@/lib/crypto";

describe("AES-256-GCM", () => {
  it("şifrele-çöz gidiş dönüş", () => {
    expect(decryptText(encryptText("JBSWY3DPEHPK3PXP"))).toBe("JBSWY3DPEHPK3PXP");
  });
  it("her şifreleme farklı çıktı üretir (rastgele IV)", () => {
    expect(encryptText("aynı")).not.toBe(encryptText("aynı"));
  });
  it("kurcalanmış veri çözülemez", () => {
    const payload = encryptText("gizli");
    const buf = Buffer.from(payload, "base64");
    buf[buf.length - 1] ^= 1;
    expect(() => decryptText(buf.toString("base64"))).toThrow();
  });
});
