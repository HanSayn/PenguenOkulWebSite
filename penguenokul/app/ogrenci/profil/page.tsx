import type { Metadata } from "next";
import { requireStudent } from "@/lib/session";
import ProfileForm from "./ProfileForm";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Profil" };
export const dynamic = "force-dynamic";

export default async function OgrenciProfilPage() {
  const { student } = await requireStudent();

  return (
    <>
      <h1 className={styles.pageTitle}>Profil</h1>
      <p className={styles.sub}>Öğretmenlerin seni tanıması için sınıf ve hedef sınavını doldurmanı öneririz.</p>

      <section className={styles.panel}>
        <ProfileForm
          name={student.name}
          phone={student.phone ?? ""}
          grade={student.grade ?? ""}
          targetExam={student.targetExam ?? ""}
          parentName={student.parentName ?? ""}
          parentPhone={student.parentPhone ?? ""}
          smsConsent={student.smsConsent}
        />
      </section>
    </>
  );
}
