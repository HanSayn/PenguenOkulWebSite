"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";

export type NavItem = { href: string; label: string };

export default function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Panel menüsü">
      {items.map((item) => {
        // Kök sayfa ("/ogrenci") yalnızca tam eşleşmede aktif olur.
        const isRoot = item.href.split("/").length === 2;
        const active = isRoot
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? `${styles.link} ${styles.active}` : styles.link}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
