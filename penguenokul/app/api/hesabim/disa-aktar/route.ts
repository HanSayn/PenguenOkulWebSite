import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildExport } from "@/lib/account-data";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// KVKK madde 11: kişi kendi verisinin bir kopyasını alabilir.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const limited = await rateLimit(`export:${session.user.id}`, 5, 60 * 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "Çok sık istedin, biraz sonra tekrar dene." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }

  const data = await buildExport(session.user.id);
  if (!data) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="penguen-okul-verilerim-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
