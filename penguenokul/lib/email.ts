import nodemailer from "nodemailer";

type Mail = { to: string; subject: string; text: string; html?: string };

// SMTP ayarı yoksa (geliştirme) e-posta göndermek yerine konsola yazar.
export async function sendMail({ to, subject, text, html }: Mail) {
  const host = process.env.SMTP_HOST;

  if (!host) {
    console.log(`\n[e-posta/dev] Kime: ${to}\nKonu: ${subject}\n${text}\n`);
    return;
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transport.sendMail({
    from: process.env.MAIL_FROM ?? "Penguen Okul <no-reply@penguenokul.local>",
    to,
    subject,
    text,
    html,
  });
}

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
