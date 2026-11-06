import { MeetingUnavailableError, type MeetingProvider } from "./types";

// İskelet: Zoom / Google Meet bağlanınca doldurulacak (OAuth + toplantı oluşturma API'si gerekir).
const unavailable = (name: string, label: string): MeetingProvider => ({
  name,
  async createRoom() {
    throw new MeetingUnavailableError(`${label} henüz bağlanmadı`);
  },
  canEmbed: () => false,
});

export const zoomProvider = unavailable("zoom", "Zoom");
export const meetProvider = unavailable("meet", "Google Meet");
