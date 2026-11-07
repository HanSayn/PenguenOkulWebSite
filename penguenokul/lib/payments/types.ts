// Ödeme adaptörü sözleşmesi. Web akışı: "ödeme sayfasına yönlendir → sağlayıcı sayfasında öde →
// sağlayıcı webhook ile bildirir → kullanıcı siteye döner". Kart bilgisi bizim sunucumuzdan hiç geçmez.
export type CheckoutInput = {
  paymentId: string;
  amount: number; // kuruş
  currency: "TRY";
  description: string;
  buyer: { id: string; email: string; name: string; phone?: string | null; ip?: string };
};

export type CheckoutSession = {
  providerRef: string; // sağlayıcıdaki işlem kimliği (webhook bununla eşleşir)
  redirectUrl: string; // kullanıcının yönlendirileceği ödeme sayfası
};

export type WebhookResult = {
  providerRef: string;
  /** PENDING: sağlayıcı henüz karar vermedi (ör. dolandırıcılık incelemesi); hiçbir şey değişmez. */
  outcome: "SUCCEEDED" | "FAILED" | "PENDING";
  failureReason?: string;
  /** Sağlayıcının ödeme kimliği; iade için saklanır. */
  providerPaymentId?: string;
  /** Sağlayıcının bildirdiği tutar (kuruş). Verilirse bizim kaydımızla eşleşmesi zorunludur. */
  amount?: number;
};

export interface PaymentProvider {
  readonly name: string;
  /** true: sonuç, kullanıcının tarayıcısıyla (form POST) gelir; yanıt siteye geri yönlendirme olmalıdır. */
  readonly browserCallback?: boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /** İmzayı doğrular ve olayı çözer. İmza geçersizse WebhookSignatureError fırlatır. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
  /** Webhook/geri dönüş kaçırılırsa ödemenin gerçek durumunu sağlayıcıdan sorgular (mutabakat). */
  queryStatus?(providerRef: string): Promise<WebhookResult>;
  refund(input: { providerRef: string; providerPaymentId?: string | null; amount: number }): Promise<{ refundRef: string }>;
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
