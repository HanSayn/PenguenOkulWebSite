import path from "node:path";
import PDFDocument from "pdfkit";
import { formatTL, formatDay } from "@/lib/format";

export type InvoiceData = {
  invoiceNumber: string;
  issuedAt: Date;
  buyerName: string;
  buyerEmail: string;
  description: string;
  amount: number; // kuruş
  status: "PAID" | "REFUNDED";
};

const FONT = path.join(process.cwd(), "assets", "fonts", "DejaVuSans.ttf");
const FONT_BOLD = path.join(process.cwd(), "assets", "fonts", "DejaVuSans-Bold.ttf");

// Ödeme belgesi (A4). Türkçe karakterler için gömülü DejaVu Sans kullanılır.
// Not: Bu belge ödeme kaydıdır; resmi e-Arşiv fatura yerine geçmez (entegratör bağlanınca ayrıca üretilecek).
export function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `Ödeme Belgesi ${data.invoiceNumber}`, Author: "Penguen Okul" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font(FONT_BOLD).fontSize(22).fillColor("#1b3a57").text("Penguen Okul");
    doc.font(FONT).fontSize(10).fillColor("#5b6b7a").text("Online birebir özel ders platformu");
    doc.moveDown(1.5);

    doc.font(FONT_BOLD).fontSize(16).fillColor("#111").text("Ödeme Belgesi");
    doc.moveDown(0.5);
    doc.font(FONT).fontSize(10).fillColor("#333");
    doc.text(`Belge no: ${data.invoiceNumber}`);
    doc.text(`Tarih: ${formatDay(data.issuedAt)}`);
    doc.text(`Durum: ${data.status === "PAID" ? "Ödendi" : "İade edildi"}`);
    doc.moveDown();

    doc.font(FONT_BOLD).text("Alıcı");
    doc.font(FONT).text(data.buyerName);
    doc.text(data.buyerEmail);
    doc.moveDown(1.5);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const y = doc.y;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#c9d3dc").stroke();
    doc.font(FONT_BOLD).text("Açıklama", left, y + 8, { width: right - left - 120 });
    doc.text("Tutar", right - 110, y + 8, { width: 110, align: "right" });
    doc.moveTo(left, y + 26).lineTo(right, y + 26).stroke();
    doc.font(FONT).text(data.description, left, y + 34, { width: right - left - 120 });
    doc.text(formatTL(data.amount), right - 110, y + 34, { width: 110, align: "right" });
    doc.moveTo(left, y + 60).lineTo(right, y + 60).stroke();
    doc.font(FONT_BOLD).text("Toplam", left, y + 70, { width: right - left - 120 });
    doc.text(formatTL(data.amount), right - 110, y + 70, { width: 110, align: "right" });

    doc.font(FONT).fontSize(8).fillColor("#6b7a88").text(
      "Bu belge ödeme kaydıdır ve resmi e-Arşiv fatura yerine geçmez.",
      left, doc.page.height - 90, { width: right - left, align: "center" }
    );
    doc.end();
  });
}
