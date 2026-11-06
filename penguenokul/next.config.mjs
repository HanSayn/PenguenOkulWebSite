const isProd = process.env.NODE_ENV === "production";
const jitsiHost = process.env.JITSI_DOMAIN || "meet.jit.si";

// Next.js satır içi betik kullandığı için script-src 'unsafe-inline' gerekir (nonce'lu CSP ileride eklenebilir).
// form-action bilerek yok: ödeme sağlayıcısının sayfasına yönlendirme bazı tarayıcılarda engellenirdi.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  `frame-src https://${jitsiHost}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kamera/mikrofon yalnızca kendi sayfamız ve görüşme sağlayıcısı için
  {
    key: "Permissions-Policy",
    value: `camera=(self "https://${jitsiHost}"), microphone=(self "https://${jitsiHost}"), display-capture=(self "https://${jitsiHost}"), geolocation=()`,
  },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // pdfkit kendi veri dosyalarını çalışma anında okur; paketlenmemeli
    serverComponentsExternalPackages: ["pdfkit"],
    // Vercel gibi ortamlarda PDF için gerekli yazı tipleri dağıtıma dahil edilir
    outputFileTracingIncludes: { "/api/fatura/[paymentId]": ["./assets/fonts/**"] },
  },
};

export default nextConfig;
