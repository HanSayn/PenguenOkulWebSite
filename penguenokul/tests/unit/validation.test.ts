import { describe, expect, it } from "vitest";
import { passwordSchema, registerSchema } from "@/lib/validation";

describe("şifre kuralları", () => {
  it("kısa veya rakamsız şifre reddedilir", () => {
    expect(passwordSchema.safeParse("abc").success).toBe(false);
    expect(passwordSchema.safeParse("sadeceharfler").success).toBe(false);
  });
  it("güçlü şifre kabul edilir", () => {
    expect(passwordSchema.safeParse("Sifre12345").success).toBe(true);
  });
});

describe("kayıt şeması", () => {
  const base = { role: "STUDENT", name: "Ayşe Yılmaz", email: "Ayse@Test.com", password: "Sifre12345" };
  it("e-postayı küçük harfe çevirir", () => {
    const r = registerSchema.safeParse(base);
    expect(r.success && r.data.email).toBe("ayse@test.com");
  });
  it("yönetici rolüyle kayıt olunamaz", () => {
    expect(registerSchema.safeParse({ ...base, role: "ADMIN" }).success).toBe(false);
  });
  it("geçersiz e-posta reddedilir", () => {
    expect(registerSchema.safeParse({ ...base, email: "yok" }).success).toBe(false);
  });
});
