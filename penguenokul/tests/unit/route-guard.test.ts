import { describe, expect, it } from "vitest";
import { authConfig, roleHome, type AppRole } from "@/auth.config";

// Middleware'in rol yalıtımı: yol → rol eşleşmesi.
function check(pathname: string, role?: AppRole) {
  const url = new URL(pathname, "http://localhost");
  const res = authConfig.callbacks.authorized({
    auth: role ? ({ user: { role } } as any) : null,
    request: { nextUrl: url } as any,
  });
  if (res instanceof Response) return res.headers.get("location")?.replace("http://localhost", "") ?? "redirect";
  return res;
}

describe("rol yalıtımı", () => {
  it.each(["/ogrenci", "/ogrenci/paketler", "/ogretmen/kazanc", "/admin", "/admin/odemeler"])("girişsiz %s engellenir", (p) => {
    expect(check(p)).toBe(false);
  });

  it("her rol yalnız kendi alanına girer", () => {
    expect(check("/ogrenci/derslerim", "STUDENT")).toBe(true);
    expect(check("/ogretmen/takvim", "TEACHER")).toBe(true);
    expect(check("/admin/raporlar", "ADMIN")).toBe(true);
  });

  it.each([
    ["/admin", "STUDENT"],
    ["/admin/odemeler", "TEACHER"],
    ["/ogretmen/kazanc", "STUDENT"],
    ["/ogrenci/odemeler", "TEACHER"],
    ["/ogrenci", "ADMIN"],
  ] as [string, AppRole][])("%s alanına %s giremez, kendi paneline yönlenir", (p, role) => {
    expect(check(p, role)).toBe(roleHome[role]);
  });

  it("önek benzerliği yetki açığı yaratmaz (/adminx herkese açık sayfadır, /admin değildir)", () => {
    expect(check("/adminx")).toBe(true);
    expect(check("/ogrencilik")).toBe(true);
  });

  it("giriş yapmış kullanıcı giriş/kayıt sayfalarına gitmez", () => {
    expect(check("/giris", "STUDENT")).toBe("/ogrenci");
    expect(check("/kayit", "ADMIN")).toBe("/admin");
    expect(check("/giris")).toBe(true);
  });

  it("herkese açık sayfalar açıktır", () => {
    for (const p of ["/", "/sss", "/gizlilik"]) expect(check(p)).toBe(true);
  });
});
