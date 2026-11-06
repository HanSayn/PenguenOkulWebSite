import { jitsiProvider } from "./jitsi";
import { zoomProvider, meetProvider } from "./placeholders";
import { MeetingUnavailableError, type MeetingProvider, type MeetingRoom } from "./types";

const providers: Record<string, MeetingProvider> = {
  jitsi: jitsiProvider,
  zoom: zoomProvider,
  meet: meetProvider,
};

export function getMeetingProvider(name = process.env.MEETING_PROVIDER || "jitsi"): MeetingProvider {
  const provider = providers[name];
  if (!provider) throw new MeetingUnavailableError(`Bilinmeyen görüşme sağlayıcısı: ${name}`);
  return provider;
}

export function createMeetingRoom(input: { lessonId: string; startsAt: Date; durationMin: number }): Promise<MeetingRoom> {
  return getMeetingProvider().createRoom(input);
}

// Bağlantı kayıtlı sağlayıcılardan birinin alan adındaysa siteye gömülebilir
export function canEmbedMeeting(url: string): boolean {
  return Object.values(providers).some((p) => p.canEmbed(url));
}

export * from "./types";
