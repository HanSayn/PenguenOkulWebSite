import { prisma } from "@/lib/prisma";
import { ymdIstanbul, addDays, formatDateTime } from "@/lib/format";

export const REPORT_TYPES = ["dersler", "ogretmenler", "ogrenciler", "destek", "denetim"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

// CSV hücresi: ayraç/tırnak/satır sonu kaçışı + Excel'de formül enjeksiyonunu önleme
function cell(v: unknown): string {
  let s = v == null ? "" : v instanceof Date ? formatDateTime(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM: Excel Türkçe karakterleri doğru okusun; ayraç ";" (Türkçe Excel varsayılanı)
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

// Tarih aralığı: from/to YYYY-MM-DD (İstanbul takvim günü). Varsayılan: son 30 gün.
export function parseRange(from: string | null, to: string | null) {
  const today = ymdIstanbul(new Date());
  const f = /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") ? from! : addDays(today, -30);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(to ?? "") ? to! : today;
  // İstanbul UTC+3 sabit: gün başlangıcı/sonu UTC'ye çevrilir
  const start = new Date(`${f}T00:00:00+03:00`);
  const end = new Date(`${t}T23:59:59.999+03:00`);
  return { from: f, to: t, start, end };
}

export async function buildReport(type: ReportType, range: { start: Date; end: Date }) {
  switch (type) {
    case "dersler": {
      const lessons = await prisma.lesson.findMany({
        where: { scheduledAt: { gte: range.start, lte: range.end } },
        orderBy: { scheduledAt: "asc" },
        take: 10000,
        include: {
          teacher: { select: { name: true } },
          student: { select: { name: true } },
          topic: { select: { name: true } },
        },
      });
      return {
        headers: ["Tarih", "Öğretmen", "Öğrenci", "Konu", "Tür", "Durum", "Süre (dk)"],
        rows: lessons.map((l) => [l.scheduledAt, l.teacher.name, l.student.name, l.topic?.name ?? "", l.isTrial ? "Deneme" : "Paket", l.status, l.durationMin]),
      };
    }
    case "ogretmenler": {
      const teachers = await prisma.teacherProfile.findMany({
        orderBy: { name: "asc" },
        take: 5000,
        include: {
          user: { select: { email: true } },
          subjects: { include: { subject: { select: { name: true } } } },
          _count: { select: { lessons: true, reviews: true } },
        },
      });
      return {
        headers: ["Ad", "E-posta", "Durum", "Branşlar", "Ders sayısı", "Değerlendirme sayısı", "Komisyon (%)"],
        rows: teachers.map((t) => [
          t.name,
          t.user.email,
          t.status,
          t.subjects.map((s) => s.subject.name).join(", "),
          t._count.lessons,
          t._count.reviews,
          Math.round(t.commissionRate * 100),
        ]),
      };
    }
    case "ogrenciler": {
      // Telefon ve veli bilgisi raporlara girmez (veri minimizasyonu)
      const students = await prisma.studentProfile.findMany({
        orderBy: { name: "asc" },
        take: 10000,
        include: { user: { select: { email: true, createdAt: true } }, _count: { select: { lessons: true } } },
      });
      return {
        headers: ["Ad", "E-posta", "Sınıf", "Hedef sınav", "Kayıt tarihi", "Ders sayısı"],
        rows: students.map((s) => [s.name, s.user.email, s.grade ?? "", s.targetExam ?? "", s.user.createdAt, s._count.lessons]),
      };
    }
    case "destek": {
      const tickets = await prisma.supportTicket.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        orderBy: { createdAt: "asc" },
        take: 10000,
        include: { user: { select: { email: true } }, _count: { select: { messages: true } } },
      });
      return {
        headers: ["Açılış", "Konu", "Talep eden", "Durum", "Mesaj sayısı"],
        rows: tickets.map((t) => [t.createdAt, t.subject, t.user.email, t.status, t._count.messages]),
      };
    }
    case "denetim": {
      const logs = await prisma.auditLog.findMany({
        where: { createdAt: { gte: range.start, lte: range.end } },
        orderBy: { createdAt: "asc" },
        take: 10000,
        include: { admin: { select: { email: true } } },
      });
      return {
        headers: ["Tarih", "Yönetici", "İşlem", "Hedef türü", "Hedef"],
        rows: logs.map((l) => [l.createdAt, l.admin.email, l.action, l.targetType, l.targetId]),
      };
    }
  }
}
