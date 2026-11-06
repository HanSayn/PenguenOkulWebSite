// Türkiye 2016'dan beri yaz saati uygulamıyor: Europe/Istanbul sabit UTC+3.
const TZ = "Europe/Istanbul";

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, ...opts });

export const formatDateTime = (d: Date) =>
  fmt({ weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);

export const formatDay = (d: Date) =>
  fmt({ weekday: "long", day: "numeric", month: "long" }).format(d);

export const formatTime = (d: Date) => fmt({ hour: "2-digit", minute: "2-digit" }).format(d);

// "2026-11-01" biçiminde, İstanbul takvimine göre gün anahtarı
export const ymdIstanbul = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const istanbulDate = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+03:00`);

// 0 = Pazar … 6 = Cumartesi
export const weekdayOf = (ymd: string) => new Date(`${ymd}T12:00:00+03:00`).getUTCDay();

export const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// Para alanları kuruş cinsinden tutulur
// Tam liralarda kuruş gizlenir (₺240), kuruş varsa gösterilir (₺1.250,50): tutar asla yuvarlanarak yanlış gösterilmez.
export const formatTL = (kurus: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: kurus % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(kurus / 100);
