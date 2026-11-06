import styles from "./BarList.module.css";

type Item = { label: string; value: number };

// Hafif, bağımlılıksız yatay çubuk grafik. Sayılar metin olarak da yazıldığı için
// çubuklar yalnızca görsel destektir (ekran okuyuculardan gizlenir).
export default function BarList({ items, unit = "" }: { items: Item[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className={styles.list}>
      {items.map((i) => (
        <li key={i.label} className={styles.item}>
          <span className={styles.label}>{i.label}</span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className={styles.value}>
            {i.value}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
