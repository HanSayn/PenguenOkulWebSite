import Link from "next/link";
import Sidebar, { type NavItem } from "./Sidebar";
import styles from "./AppShell.module.css";

type Props = {
  roleLabel: string;
  items: NavItem[];
  children: React.ReactNode;
};

// Üç rol paneli (öğrenci / öğretmen / admin) için ortak iskelet.
export default function AppShell({ roleLabel, items, children }: Props) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand}>
          <span aria-hidden="true">🐧</span> Penguen Okul
        </Link>
        <span className={styles.role}>{roleLabel}</span>
        <Sidebar items={items} />
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <span className={styles.topTitle}>{roleLabel} paneli</span>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
