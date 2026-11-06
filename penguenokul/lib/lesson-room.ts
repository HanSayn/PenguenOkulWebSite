// Ders odasına giriş penceresi: ders başlamadan `opensMin` dk önce açılır, bitişten 30 dk sonra kapanır.
const GRACE_AFTER_MIN = 30;

export function joinWindow(scheduledAt: Date, durationMin: number, opensMin: number) {
  return {
    opensAt: new Date(scheduledAt.getTime() - opensMin * 60_000),
    closesAt: new Date(scheduledAt.getTime() + (durationMin + GRACE_AFTER_MIN) * 60_000),
  };
}

export function isJoinable(now: Date, scheduledAt: Date, durationMin: number, opensMin: number) {
  const w = joinWindow(scheduledAt, durationMin, opensMin);
  return now >= w.opensAt && now <= w.closesAt;
}
