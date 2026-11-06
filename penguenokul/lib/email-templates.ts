import { appUrl } from "@/lib/email";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Template = { title: string; body: string; ctaPath?: string; ctaLabel?: string };

// Tüm bildirim e-postaları aynı sade şablondan çıkar; içerik title/body ile gelir.
export function renderNotificationEmail({ title, body, ctaPath, ctaLabel }: Template) {
  const url = ctaPath ? `${appUrl()}${ctaPath}` : null;
  const label = ctaLabel ?? "Panele git";

  const text = [title, "", body, ...(url ? ["", `${label}: ${url}`] : []), "", "— Penguen Okul"].join("\n");

  const html = `<!doctype html>
<html lang="tr"><body style="margin:0;background:#eef5fb;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b1b2e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px">
      <tr><td style="font-weight:700;font-size:16px">🐧 Penguen Okul</td></tr>
      <tr><td style="padding-top:16px;font-size:20px;font-weight:700">${escapeHtml(title)}</td></tr>
      <tr><td style="padding-top:8px;font-size:15px;line-height:1.6">${escapeHtml(body)}</td></tr>
      ${
        url
          ? `<tr><td style="padding-top:20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#f78c1f;color:#0b1b2e;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:999px">${escapeHtml(label)}</a></td></tr>`
          : ""
      }
    </table>
  </td></tr></table>
</body></html>`;

  return { subject: title, text, html };
}
