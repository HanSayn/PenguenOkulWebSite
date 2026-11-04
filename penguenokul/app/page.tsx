import Link from "next/link";
import styles from "./page.module.css";

const features = [
  {
    title: "Birebir canlı ders",
    text: "Matematikten İngilizceye tüm branşlarda, yüz yüze ders konforunda online 1'e 1 dersler.",
  },
  {
    title: "Seçkin öğretmenler",
    text: "Profili incelenmiş, onay sürecinden geçmiş ve öğrenciler tarafından puanlanan eğitmenler.",
  },
  {
    title: "Esnek takvim",
    text: "Ders gün ve saatini kendi programına göre seç; öğretmen onayı 24 saat içinde.",
  },
  {
    title: "Şeffaf paketler",
    text: "Ders sayısına göre paket seç, kalan hakkını ve ödeme geçmişini panelden takip et.",
  },
];

const steps = [
  { n: "1", title: "Kayıt ol", text: "Öğrenci ya da öğretmen olarak ücretsiz hesap oluştur." },
  { n: "2", title: "Öğretmenini seç", text: "Branşa, puana ve müsait saatlere göre filtrele." },
  { n: "3", title: "Derse katıl", text: "Onaylanan dersin bağlantısı ders başlamadan 15 dakika önce açılır." },
];

export default function LandingPage() {
  return (
    <>
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Link href="/" className={styles.logo}>
            <span aria-hidden="true">🐧</span> Penguen Okul
          </Link>
          <nav className={styles.nav} aria-label="Ana menü">
            <Link href="/giris" className={styles.navLink}>Giriş yap</Link>
            <Link href="/kayit" className={styles.cta}>Ücretsiz kayıt</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={`container ${styles.heroInner}`}>
            <p className={styles.eyebrow}>YKS · LGS · KPSS</p>
            <h1>Doğru öğretmenle, doğru zamanda, birebir ders.</h1>
            <p className={styles.lead}>
              Penguen Okul, uzman öğretmenleri öğrencilerle buluşturan online özel ders
              platformu. İlk deneme dersin ücretsiz.
            </p>
            <div className={styles.actions}>
              <Link href="/kayit?rol=ogrenci" className={styles.cta}>Öğrenci olarak başla</Link>
              <Link href="/kayit?rol=ogretmen" className={styles.secondary}>Öğretmen olarak katıl</Link>
            </div>
          </div>
        </section>

        <section className="container" aria-labelledby="ozellikler">
          <h2 id="ozellikler" className={styles.sectionTitle}>Neden Penguen Okul?</h2>
          <div className={styles.grid}>
            {features.map((f) => (
              <article key={f.title} className={styles.card}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={`container ${styles.stepsSection}`} aria-labelledby="nasil">
          <h2 id="nasil" className={styles.sectionTitle}>Nasıl çalışır?</h2>
          <ol className={styles.steps}>
            {steps.map((s) => (
              <li key={s.n} className={styles.step}>
                <span className={styles.stepNum}>{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className="container">© {new Date().getFullYear()} Penguen Okul</div>
      </footer>
    </>
  );
}
