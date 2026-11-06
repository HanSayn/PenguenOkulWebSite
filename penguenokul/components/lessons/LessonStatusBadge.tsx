import styles from "./LessonStatusBadge.module.css";

const labels: Record<string, { text: string; tone: "info" | "success" | "danger" | "muted" }> = {
  REQUESTED: { text: "Onay bekliyor", tone: "info" },
  CONFIRMED: { text: "Onaylandı", tone: "success" },
  REJECTED: { text: "Reddedildi", tone: "danger" },
  EXPIRED: { text: "Yanıtsız kaldı", tone: "muted" },
  CANCELLED: { text: "İptal edildi", tone: "muted" },
  COMPLETED: { text: "Tamamlandı", tone: "success" },
  NO_SHOW: { text: "Katılım olmadı", tone: "danger" },
};

export default function LessonStatusBadge({ status }: { status: string }) {
  const item = labels[status] ?? { text: status, tone: "muted" as const };
  return <span className={`${styles.badge} ${styles[item.tone]}`}>{item.text}</span>;
}
