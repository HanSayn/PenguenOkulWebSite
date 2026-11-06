import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { setTeacherStatusAction } from "@/lib/admin-actions";
import { setCommissionAction } from "@/lib/payout-actions";
import { formatDay } from "@/lib/format";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Öğretmenler" };
export const dynamic = "force-dynamic";

const tabs = [
  { value: "PENDING", label: "Bekleyen" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "SUSPENDED", label: "Askıda / reddedilen" },
  { value: "ALL", label: "Tümü" },
];

const statusLabel: Record<string, string> = { PENDING: "Onay bekliyor", ACTIVE: "Aktif", SUSPENDED: "Askıda" };

const okMessages: Record<string, string> = {
  approve: "Öğretmen onaylandı, kendisine e-posta gönderildi.",
  reject: "Başvuru reddedildi.",
  suspend: "Öğretmen askıya alındı, bekleyen talepleri reddedildi.",
  komisyon: "Komisyon oranı güncellendi. Yalnızca bundan sonra tamamlanan dersleri etkiler.",
  reactivate: "Öğretmen yeniden etkinleştirildi.",
};

const errMessages: Record<string, string> = {
  gecersiz: "Geçersiz işlem.",
  bulunamadi: "Öğretmen bulunamadı.",
  "durum-degismis": "Öğretmenin durumu bu arada değişmiş. Liste yenilendi.",
  brans: "Öğretmen henüz branş seçmediği için etkinleştirilemez.",
  komisyon: "Komisyon 0 ile 50 arasında bir yüzde olmalı.",
};

type Row = {
  id: string;
  name: string;
  bio: string | null;
  osymScore: number | null;
  status: string;
  commissionRate: number;
  user: { email: string; createdAt: Date };
  subjects: { subject: { name: string } }[];
};

export default async function AdminOgretmenlerPage({
  searchParams,
}: {
  searchParams: { durum?: string; ok?: string; hata?: string; acik?: string };
}) {
  await requireAdmin();
  const filter = tabs.some((t) => t.value === searchParams.durum) ? searchParams.durum! : "PENDING";

  const teachers = (await prisma.teacherProfile.findMany({
    where: filter === "ALL" ? {} : { status: filter as "PENDING" | "ACTIVE" | "SUSPENDED" },
    orderBy: { user: { createdAt: "desc" } },
    take: 100,
    include: {
      user: { select: { email: true, createdAt: true } },
      subjects: { include: { subject: { select: { name: true } } } },
    },
  })) as Row[];

  const open = Number(searchParams.acik ?? 0);

  return (
    <>
      <h1 className={styles.pageTitle}>Öğretmenler</h1>
      <p className={styles.sub}>Başvuruları onayla, hesapları askıya al veya yeniden etkinleştir.</p>

      {searchParams.ok && okMessages[searchParams.ok] && (
        <p role="status" className={`${styles.alert} ${styles.alertOk}`}>{okMessages[searchParams.ok]}</p>
      )}
      {open > 0 && (
        <p role="status" className={`${styles.alert} ${styles.warn}`}>
          Bu öğretmenin {open} onaylı dersi hâlâ duruyor. Gerekirse <Link href="/admin/dersler">Dersler</Link> sayfasından iptal edebilirsin.
        </p>
      )}
      {searchParams.hata && (
        <p role="alert" className={`${styles.alert} ${styles.alertErr}`}>
          {errMessages[searchParams.hata] ?? "Bir sorun oluştu."}
        </p>
      )}

      <nav className={styles.filters} aria-label="Durum filtresi">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`/admin/ogretmenler?durum=${t.value}`}
            className={`${styles.filter} ${filter === t.value ? styles.filterActive : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {teachers.length === 0 ? (
        <div className={styles.empty}>Bu filtrede öğretmen yok.</div>
      ) : (
        <ul className={styles.list}>
          {teachers.map((t) => (
            <li key={t.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {t.name} <span className={styles.tag}>{statusLabel[t.status] ?? t.status}</span>
                </span>
                <span className={styles.rowMeta}>
                  {t.user.email} · başvuru: {formatDay(t.user.createdAt)}
                  {t.osymScore != null ? ` · ÖSYM: ${t.osymScore}` : ""}
                </span>
                <span className={styles.rowMeta}>
                  {t.subjects.length > 0
                    ? `Branşlar: ${t.subjects.map((s) => s.subject.name).join(", ")}`
                    : "Branş seçilmemiş"}
                </span>
                {t.bio && <span className={styles.rowMeta}>{t.bio}</span>}
              </div>

              <form action={setTeacherStatusAction} className={styles.inlineForm}>
                <input type="hidden" name="teacherId" value={t.id} />
                {t.status !== "SUSPENDED" && (
                  <input
                    name="reason"
                    maxLength={300}
                    placeholder={t.status === "PENDING" ? "Ret gerekçesi (isteğe bağlı)" : "Askı gerekçesi (isteğe bağlı)"}
                    className={`${styles.input} ${styles.textInput}`}
                    aria-label="Gerekçe"
                  />
                )}
                {t.status === "PENDING" && (
                  <>
                    <button type="submit" name="intent" value="approve" className={styles.button}>Onayla</button>
                    <button type="submit" name="intent" value="reject" className={styles.buttonSecondary}>Reddet</button>
                  </>
                )}
                {t.status === "ACTIVE" && (
                  <button type="submit" name="intent" value="suspend" className={styles.buttonSecondary}>Askıya al</button>
                )}
                {t.status === "SUSPENDED" && (
                  <button type="submit" name="intent" value="reactivate" className={styles.button}>Yeniden etkinleştir</button>
                )}
              </form>

              <form action={setCommissionAction} className={styles.inlineForm}>
                <input type="hidden" name="teacherId" value={t.id} />
                <label htmlFor={`komisyon-${t.id}`} className={styles.rowMeta}>Komisyon %</label>
                <input
                  id={`komisyon-${t.id}`}
                  name="percent"
                  inputMode="decimal"
                  defaultValue={String(Math.round(t.commissionRate * 1000) / 10).replace(".", ",")}
                  className={styles.input}
                  style={{ width: 72 }}
                />
                <button type="submit" className={styles.buttonSecondary}>Kaydet</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
