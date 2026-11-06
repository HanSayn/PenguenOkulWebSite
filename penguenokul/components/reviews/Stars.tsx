import styles from "./reviews.module.css";

export default function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className={styles.static} role="img" aria-label={`5 üzerinden ${value.toFixed(1)}`}>
      {"★".repeat(full)}<span className={styles.off}>{"★".repeat(5 - full)}</span>
    </span>
  );
}
