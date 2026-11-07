import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "./auth.config";
import { buildCsp, newNonce } from "./lib/csp";

// Yalnızca edge-uyumlu config kullanılır; yetki kararı authConfig.callbacks.authorized içinde.
const authMiddleware = NextAuth(authConfig).auth;

export default async function middleware(req: NextRequest, evt: NextFetchEvent) {
  const nonce = newNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV !== "production", frameHost: process.env.JITSI_DOMAIN });

  // 1) Yetki kararı (yönlendirme ya da geçiş)
  const authRes = (await (authMiddleware as unknown as (r: NextRequest, e: NextFetchEvent) => Promise<Response | undefined>)(req, evt)) ?? NextResponse.next();

  // Yönlendirme ya da hata: aynen döndür, yalnızca CSP ekle
  if (authRes.status >= 300 || authRes.headers.has("location")) {
    authRes.headers.set("Content-Security-Policy", csp);
    return authRes;
  }

  // 2) Geçiş: nonce, sayfayı üreten sunucuya istek başlığıyla iletilir (Next betiklere uygular)
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  // Oturum çerezi yenilemesi gibi auth'un koyduğu çerezleri koru
  authRes.headers.getSetCookie().forEach((c) => res.headers.append("set-cookie", c));
  return res;
}

export const config = {
  // API, statik dosyalar ve Next iç yolları hariç tüm sayfalar
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
