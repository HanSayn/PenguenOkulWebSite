// İçerik Güvenlik Politikası. Edge (middleware) uyumludur: yalnızca saf fonksiyonlar.
// Betikler istek başına rastgele nonce ile yetkilenir; 'unsafe-inline' script için yoktur.
// form-action bilerek yok: ödeme sağlayıcısının sayfasına yönlendirme bazı tarayıcılarda engellenirdi.
export function buildCsp(nonce: string, opts: { dev?: boolean; frameHost?: string } = {}): string {
  const frameHost = opts.frameHost || "meet.jit.si";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // React style özellikleri ve Next'in satır içi stilleri için
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    `frame-src https://${frameHost}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
