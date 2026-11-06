import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runScheduledJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Zamanlanmış işleri tetikler. Herhangi bir zamanlayıcı çağırabilir (Vercel Cron, harici ping, sistem crontab):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://alanadi.com/api/cron/run
// Vercel Cron, CRON_SECRET tanımlıysa bu başlığı kendisi ekler.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET) {
    // Gizli anahtar yoksa endpoint herkese açık kalmasın
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil." }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const report = await runScheduledJobs();
  return NextResponse.json({ ok: true, ...report });
}

export const GET = handle;
export const POST = handle;
