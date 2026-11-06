import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/ui/panel.module.css";

export const metadata: Metadata = {
  title: "Gizlilik, KVKK ve çerezler",
  description: "Penguen Okul kişisel verileri nasıl işler, hangi çerezleri kullanır.",
};

export default function GizlilikPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-6) 16px", lineHeight: 1.7 }}>
      <p><Link href="/" className={styles.rowMeta}>← Ana sayfa</Link></p>
      <h1 className={styles.pageTitle}>Gizlilik, KVKK ve çerezler</h1>
      <p className={styles.sub}>
        Bu metin bilgilendirme amaçlı taslaktır; yayına almadan önce veri sorumlusu bilgileri (unvan, adres, iletişim) hukuk danışmanınla tamamlanmalıdır.
      </p>

      <h2>Hangi verileri işliyoruz?</h2>
      <p>
        Ad, e-posta, (isteğe bağlı) telefon ve sınıf bilgisi; ders talepleri, ders kayıtları, mesajlar, ödev ve değerlendirmeler; ödeme kayıtları.
        Kart bilgileri sitemizde tutulmaz, ödeme sağlayıcısının sayfasında girilir.
      </p>

      <h2>Neden işliyoruz?</h2>
      <p>
        Hesabını yönetmek, ders eşleştirmesi ve randevu süreçlerini yürütmek, ödemeleri ve öğretmen hakedişlerini hesaplamak,
        yasal yükümlülükleri yerine getirmek. SMS hatırlatması yalnızca profilinde açık rıza verdiysen gönderilir ve her an kapatılabilir.
      </p>

      <h2>Çerezler</h2>
      <p>
        Yalnızca oturumunu sürdürmek ve güvenliği sağlamak için zorunlu çerezler kullanılır. Reklam ya da izleme çerezi yoktur,
        bu nedenle ayrıca onay penceresi gösterilmez. Ders odası, görüntülü görüşme sağlayıcısının sayfasını (varsayılan: Jitsi) sitede açar;
        bu sağlayıcı kendi koşullarıyla çalışır.
      </p>

      <h2>Haklarınız</h2>
      <p>
        KVKK madde 11 kapsamında verilerine erişme, düzeltme, silme ve itiraz hakların vardır. Talepler için destek sayfandan bize yazabilirsin.
      </p>
    </main>
  );
}
