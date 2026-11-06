"use client";

import { useEffect, useRef } from "react";

// Konuşma açıldığında ve yeni mesaj geldiğinde listenin sonuna kaydırır.
export default function ScrollToEnd({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el?.parentElement) el.parentElement.scrollTop = el.parentElement.scrollHeight;
  }, [count]);
  return <div ref={ref} aria-hidden="true" />;
}
