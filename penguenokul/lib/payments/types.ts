// Ödeme adaptörü sözleşmesi. Web akışı: "ödeme sayfasına yönlendir → sağlayıcı sayfasında öde →
// sağlayıcı webhook ile bildirir → kullanıcı siteye döner". Kart bilgisi bizim sunucumuzdan hiç geçmez.
export type CheckoutInput = {
  paymentId: string;
  amount: number; // kuruş
  currency: "TRY";
  description: string;
  buyer: { id: string; email: string; name: string };
};

export type CheckoutSession = {
  providerRef: string; // sağlayıcıdaki işlem kimliği (webhook bununla eşleşir)
  redirectUrl: string; // kullanıcının yönlendirileceği ödeme sayfası
};

export type WebhookResult = {
  providerRef: string;
  outcome: "SUCCEEDED" | "FAILED";
  failureReason?: string;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /** İmzayı doğrular ve olayı çözer. İmza geçersizse WebhookSignatureError fırlatır. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
  refund(input: { providerRef: string; amount: number }): Promise<{ refundRef: string }>;
}

export class WebhookSignatureError extends Error {
  constructor(message = "Webhook imzası geçersiz") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export class ProviderUnavailableError extends Error {
  constructor(message = "Ödeme sağlayıcısı şu an kullanılamıyor") {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}
