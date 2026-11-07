const isProd = process.env.NODE_ENV === "production";
const jitsiHost = process.env.JITSI_DOMAIN || "meet.jit.si";

// İçerik Güvenlik Politikası (CSP) nonce gerektirdiği için istek başına middleware.ts içinde üretilir (lib/csp.ts).

const securityHeaders = [
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
