import { getPaymentProvider, ProviderUnavailableError, WebhookSignatureError } from "@/lib/payments";
import { settlePayment } from "@/lib/payments/settle";

export const dynamic = "force-dynamic";

// Sağlayıcıdan gelen ödeme sonucu. Oturum yoktur; güvenlik imza doğrulamasına dayanır.
// İdempotent: aynı bildirim tekrar gelirse ikinci kez paket tanımlanmaz.
export async function POST(request: Request, { params }: { params: { provider: string } }) {
  let provider;
  try {
    provider = getPaymentProvider(params.provider);
  } catch (err) {
    if (err instanceof ProviderUnavailableError) return Response.json({ error: "Sağlayıcı kullanılamıyor" }, { status: 404 });
    throw err;
  }

  const rawBody = await request.text();
  let event;
  try {
    event = await provider.parseWebhook(rawBody, request.headers);
  } catch (err) {
    if (err instanceof WebhookSignatureError) return Response.json({ error: "İmza geçersiz" }, { status: 401 });
    if (err instanceof ProviderUnavailableError) return Response.json({ error: "Sağlayıcı kullanılamıyor" }, { status: 503 });
    console.error("webhook çözümlenemedi", err);
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const result = await settlePayment(event.providerRef, event.outcome, event.failureReason);
  if (!result.found) return Response.json({ error: "Ödeme bulunamadı" }, { status: 404 });
  return Response.json({ ok: true, changed: result.changed, status: result.status });
}
