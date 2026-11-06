import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Yalnızca edge-uyumlu config kullanılır; yetki kararı authConfig.callbacks.authorized içinde.
export default NextAuth(authConfig).auth;

export const config = {
  // API, statik dosyalar ve Next iç yolları hariç tüm sayfalar
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
