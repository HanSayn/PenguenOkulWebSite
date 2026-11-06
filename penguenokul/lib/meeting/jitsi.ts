import { createHmac } from "node:crypto";
import type { MeetingProvider } from "./types";

// Jitsi: hesap/anahtar gerektirmez. Oda adı, ders kimliğinden gizli anahtarla türetilir;
// bağlantıyı bilmeyen biri odayı tahmin edemez. Kendi sunucun varsa JITSI_DOMAIN ile değiştirilir.
export function jitsiDomain(): string {
  return process.env.JITSI_DOMAIN || "meet.jit.si";
}

function roomName(lessonId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET tanımlı değil");
  return `penguenokul-${createHmac("sha256", secret).update(`room:${lessonId}`).digest("hex").slice(0, 20)}`;
}

export const jitsiProvider: MeetingProvider = {
  name: "jitsi",
  async createRoom({ lessonId }) {
    return { url: `https://${jitsiDomain()}/${roomName(lessonId)}`, provider: "jitsi" };
  },
  canEmbed(url) {
    try {
      return new URL(url).host === jitsiDomain();
    } catch {
      return false;
    }
  },
};
