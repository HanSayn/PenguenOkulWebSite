import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { decryptText } from "@/lib/crypto";
import { qrDataUrl, totpUri } from "@/lib/two-factor";
import { startTwoFactorSetupAction } from "@/lib/security-actions";
import { EnableForm, DisableForm } from "./TwoFactorForms";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = { title: "Güvenlik" };
export const dynamic = "force-dynamic";

export default async function AdminGuvenlikPage() {
  const { user } = await requireAdmin();
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, twoFactorEnabled: true, twoFactorSecret: true },
  });
  const enabled = !!me?.twoFactorEnabled;
  const pendingSecret = !enabled && me?.twoFactorSecret ? decryptText(me.twoFactorSecret) : null;
  const qr = pendingSecret ? await qrDataUrl(totpUri(me!.email, pendingSecret)) : null;

  return (
    <>
      <h1 className={styles.pageTitle}>Güvenlik</h1>
      <p className={styles.sub}>Yönetici hesabını iki adımlı doğrulama (TOTP) ile koru. Her girişte şifreye ek olarak 6 haneli bir kod istenir.</p>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>İki adımlı doğrulama</h2>
        {enabled ? (
          <>
            <p className={styles.rowMeta}>Durum: <strong>Açık</strong></p>
            <DisableForm />
          </>
        ) : pendingSecret ? (
          <div className={styles.actionsStack}>
            <p>1. Google Authenticator, Microsoft Authenticator veya benzeri bir uygulamada yeni hesap ekle.</p>
            <p>2. Aşağıdaki QR kodu tara ya da anahtarı elle gir:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr!} alt="İki adımlı doğrulama QR kodu" width={220} height={220} style={{ background: "#fff", padding: 8, borderRadius: 8 }} />
            <code style={{ wordBreak: "break-all" }}>{pendingSecret}</code>
            <p>3. Uygulamada görünen 6 haneli kodu girerek etkinleştir.</p>
            <EnableForm />
          </div>
        ) : (
          <div className={styles.actionsStack}>
            <p className={styles.rowMeta}>Durum: <strong>Kapalı</strong></p>
            <form action={startTwoFactorSetupAction}>
              <button type="submit" className={styles.button}>Kurulumu başlat</button>
            </form>
          </div>
        )}
      </section>
    </>
  );
}
