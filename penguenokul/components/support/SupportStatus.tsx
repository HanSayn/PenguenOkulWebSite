const labels: Record<string, string> = { OPEN: "Açık", IN_PROGRESS: "İnceleniyor", CLOSED: "Kapalı" };
export default function SupportStatus({ status }: { status: string }) {
  return <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{labels[status] ?? status}</span>;
}
