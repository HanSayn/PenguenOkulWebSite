import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "../styles/globals.css";

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0f3d5e" };

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  openGraph: { type: "website", locale: "tr_TR", siteName: "Penguen Okul" },
  title: {
    default: "Penguen Okul — Birebir Online Özel Ders",
    template: "%s | Penguen Okul",
  },
  description:
    "YKS, LGS ve KPSS için uzman öğretmenlerle birebir online özel ders. Ücretsiz deneme dersiyle başla.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Nonce her istekte değiştiği için sayfalar istek anında üretilmeli; headers() okumak bunu sağlar ve
  // Next'in kendi betiklerine middleware'in ürettiği nonce'u uygulamasını mümkün kılar.
  headers();
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
