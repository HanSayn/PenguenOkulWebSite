import { prisma } from "@/lib/prisma";

// Admin panelinden düzenlenebilen ayarlar. Komisyon gibi finans ayarları bilerek burada yok.
export const SETTING_FIELDS = [
  {
    key: "cancelWindowHours",
    label: "Öğrenci iptal süresi",
    unit: "saat",
    hint: "Onaylı bir ders, başlamasına bu süreden az kaldıysa öğrenci tarafından iptal edilemez.",
    min: 0,
    max: 168,
    fallback: 12,
  },
  {
    key: "requestExpiryHours",
    label: "Talep yanıt süresi",
    unit: "saat",
    hint: "Yalnızca yeni talepler için geçerli; mevcut taleplerin süresi değişmez.",
    min: 1,
    max: 168,
    fallback: 24,
  },
  {
    key: "trialLessonMinutes",
    label: "Deneme dersi süresi",
    unit: "dakika",
    hint: "Yeni deneme taleplerinde kullanılır.",
    min: 15,
    max: 120,
    fallback: 30,
  },
  {
    key: "meetingLinkOpensMinutesBefore",
    label: "Görüşme linki açılışı",
    unit: "dakika",
    hint: "Link, ders başlamadan bu kadar dakika önce öğrenciye görünür.",
    min: 0,
    max: 120,
    fallback: 15,
  },
] as const;

// Setting tablosundan sayı okur; kayıt yoksa ya da sayı değilse varsayılanı döner.
export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key } });
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
