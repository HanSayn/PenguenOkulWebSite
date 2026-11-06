// Görüşme (video ders) adaptörü sözleşmesi. Jitsi, Zoom, Google Meet gibi sağlayıcılar aynı arayüzle bağlanır.
export type MeetingRoom = { url: string; provider: string };

export interface MeetingProvider {
  readonly name: string;
  createRoom(input: { lessonId: string; startsAt: Date; durationMin: number }): Promise<MeetingRoom>;
  /** Bağlantı site içinde (iframe) gösterilebilir mi? Yalnızca kendi alan adımız için true. */
  canEmbed(url: string): boolean;
}

export class MeetingUnavailableError extends Error {
  constructor(message = "Görüşme sağlayıcısı şu an kullanılamıyor") {
    super(message);
    this.name = "MeetingUnavailableError";
  }
}
