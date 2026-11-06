import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { SETTING_FIELDS, getNumberSetting } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Ayarlar" };
export const dynamic = "force-dynamic";

export default async function AdminAyarlarPage() {
  await requireAdmin();

  const fields = await Promise.all(
    SETTING_FIELDS.map(async (f) => ({
      key: f.key,
      label: f.label,
      unit: f.unit,
      hint: f.hint,
      min: f.min,
      max: f.max,
      value: await getNumberSetting(f.key, f.fallback),
    }))
  );

  return (
    <>
      <h1 className={styles.pageTitle}>Sistem ayarları</h1>
      <p className={styles.sub}>Değişiklikler anında geçerli olur ve denetim kaydına yazılır.</p>
      <section className={styles.panel}>
        <SettingsForm fields={fields} />
      </section>
    </>
  );
}
