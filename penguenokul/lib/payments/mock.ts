import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { WebhookSignatureError, type PaymentProvider } from "./types";

// Geliştirme ve demo için sahte sağlayıcı: gerçek para hareketi yoktur.
// Ödeme sayfası sitenin içinde (/odeme/sahte/[ref]) çalışır, webhook imzası gerçek sağlayıcılardaki gibi doğrulanır.
export function webhookSecret(): string {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("PAYMENT_WEBHOOK_SECRET veya AUTH_SECRET tanımlı değil");
  return secret;
}

export function signMockWebhook(rawBody: string): string {
  return createHmac("sha256", webhookSecret()).update(rawBody).digest("hex");
}

export const mockProvider: PaymentProvider = {
  name: "mock",

  async createCheckout() {
    const providerRef = `mock_${randomBytes(12).toString("hex")}`;
    // Göreli yol: kullanıcı hangi adresten girdiyse oturum çerezi kaybolmadan aynı sitede kalır
    return { providerRef, redirectUrl: `/odeme/sahte/${providerRef}` };
  },

  async parseWebhook(rawBody, headers) {
    const given = headers.get("x-mock-signature") ?? "";
    const expected = signMockWebhook(rawBody);
    const a = Buffer.from(given, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new WebhookSignatureError();

    const body = JSON.parse(rawBody) as { providerRef?: string; outcome?: string; failureReason?: string };
    if (!body.providerRef || (body.outcome !== "SUCCEEDED" && body.outcome !== "FAILED")) {
      throw new WebhookSignatureError("Webhook gövdesi geçersiz");
    }
    return { providerRef: body.providerRef, outcome: body.outcome, failureReason: body.failureReason };
  },

  async refund() {
    return { refundRef: `mockrefund_${randomBytes(8).toString("hex")}` };
  },
};
