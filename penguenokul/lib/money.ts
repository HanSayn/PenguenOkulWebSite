// "2.400,50", "2400,5", "2400.50", "2400" → kuruş. Geçersizse null.
export function parseTLToKurus(input: string): number | null {
  let s = input.trim().replace(/\s|₺|TL/gi, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const kurus = Math.round(parseFloat(s) * 100);
  return kurus > 0 && kurus <= 100_000_000 ? kurus : null; // en fazla 1.000.000 TL
}
