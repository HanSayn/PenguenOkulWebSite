import type { SmsProvider } from "./types";

// Varsayılan: SMS kapalı. "console" yalnızca geliştirmede mesajı konsola yazar.
const providers: Record<string, SmsProvider> = {
  console: {
    name: "console",
    async send({ to, text }) {
      console.log(`[sms/dev] ${to}: ${text}`);
    },
  },
  // İskelet: Netgsm bağlanınca doldurulacak (NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_HEADER).
  netgsm: {
    name: "netgsm",
    async send() {
      throw new Error("Netgsm henüz bağlanmadı");
    },
  },
};

export function smsEnabled(): boolean {
  const name = process.env.SMS_PROVIDER ?? "none";
  return name !== "none" && !!providers[name];
}

// "0532 123 45 67" / "+90 532 ..." → "905321234567". Cep telefonu değilse null.
export function normalizeTrMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("90") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^5\d{9}$/.test(national) ? `90${national}` : null;
}

// En iyi çaba: SMS hatası asıl işlemi (ders hatırlatması vb.) asla bozmaz.
export async function sendSms(rawTo: string, text: string): Promise<boolean> {
  if (!smsEnabled()) return false;
  const to = normalizeTrMobile(rawTo);
  if (!to) return false;
  try {
    await providers[process.env.SMS_PROVIDER as string].send({ to, text: text.slice(0, 300) });
    return true;
  } catch (err) {
    console.error("[sms] gönderilemedi", err);
    return false;
  }
}

export * from "./types";
