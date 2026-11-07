import { getPaymentProvider, ProviderUnavailableError, WebhookSignatureError } from "@/lib/payments";
import { settleProviderEvent } from "@/lib/payments/settle";

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

  // Tarayıcı geri dönüşü (iyzico): kullanıcıya JSON değil, siteye geri yönlendirme dönülür
  const back = (path: string) => Response.redirect(new URL(path, process.env.APP_URL || request.url), 303);

  const rawBody = await request.text();
  let event;
  try {
    event = await provider.parseWebhook(rawBody, request.headers);
  } catch (err) {
    if (provider.browserCallback) {
      console.error("ödeme geri dönüşü doğrulanamadı", err);
      return back("/ogrenci/odemeler?hata=dogrulama"); // para çekildiyse mutabakat işi kısa sürede tanımlar
    }
    if (err instanceof WebhookSignatureError) return Response.json({ error: "İmza geçersiz" }, { status: 401 });
    if (err instanceof ProviderUnavailableError) return Response.json({ error: "Sağlayıcı kullanılamıyor" }, { status: 503 });
    console.error("webhook çözümlenemedi", err);
    return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const result = await settleProviderEvent(event);
  if (provider.browserCallback) {
    if (result.mismatch) return back("/ogrenci/odemeler?hata=dogrulama");
    return back(result.paymentId ? `/ogrenci/odemeler?odeme=${result.paymentId}` : "/ogrenci/odemeler");
  }
  if (!result.found) return Response.json({ error: "Ödeme bulunamadı" }, { status: 404 });
  return Response.json({ ok: true, changed: result.changed, status: result.status, ...(result.mismatch ? { mismatch: true } : {}) });
}
