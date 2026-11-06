import type { NextAuthConfig } from "next-auth";

export type AppRole = "STUDENT" | "TEACHER" | "ADMIN";

export const roleHome: Record<AppRole, string> = {
  STUDENT: "/ogrenci",
  TEACHER: "/ogretmen",
  ADMIN: "/admin",
};

// Hangi yol öneki hangi role ait
const guarded: { prefix: string; role: AppRole }[] = [
  { prefix: "/ogrenci", role: "STUDENT" },
  { prefix: "/ogretmen", role: "TEACHER" },
  { prefix: "/admin", role: "ADMIN" },
];

const authPages = ["/giris", "/kayit", "/sifremi-unuttum", "/sifre-sifirla"];

// Edge runtime'da (middleware) çalışacağı için Prisma/bcrypt burada import edilmez.
export const authConfig = {
  pages: { signIn: "/giris" },
  session: { strategy: "jwt" },
  providers: [], // Credentials provider auth.ts içinde eklenir
  callbacks: {
    authorized({ auth, request }) {
      const { pathname, origin } = request.nextUrl;
      const role = auth?.user?.role as AppRole | undefined;
      const redirectTo = (path: string) => Response.redirect(new URL(path, origin));

      const area = guarded.find(
        (g) => pathname === g.prefix || pathname.startsWith(g.prefix + "/")
      );

      if (area) {
        if (!role) return false; // giriş sayfasına yönlendirir
        if (role !== area.role) return redirectTo(roleHome[role]); // yanlış rol
        return true;
      }

      // Giriş yapmış kullanıcı giriş/kayıt sayfalarını görmesin
      if (role && authPages.includes(pathname)) return redirectTo(roleHome[role]);

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AppRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
