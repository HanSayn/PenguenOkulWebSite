import { auth } from "@/auth";
import { buildReport, parseRange, REPORT_TYPES, toCsv, type ReportType } from "@/lib/reports";

export const dynamic = "force-dynamic";

// Yalnızca yönetici indirebilir. Dosya adı tarih aralığını taşır.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return new Response("Yetkisiz", { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("tur") as ReportType;
  if (!(REPORT_TYPES as readonly string[]).includes(type)) {
    return new Response("Geçersiz rapor türü", { status: 400 });
  }

  const range = parseRange(url.searchParams.get("baslangic"), url.searchParams.get("bitis"));
  const report = await buildReport(type, range);
  const body = toCsv(report.headers, report.rows);

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${range.from}_${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
