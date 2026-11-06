import { mockProvider } from "./mock";
import { iyzicoProvider } from "./iyzico";
import { ProviderUnavailableError, type PaymentProvider } from "./types";

const providers: Record<string, PaymentProvider> = {
  mock: mockProvider,
  iyzico: iyzicoProvider,
};

// Sahte sağlayıcı canlıda "bedava paket" kapısı olmasın diye yalnızca geliştirmede
// ya da ALLOW_MOCK_PAYMENTS=true ile bilinçli olarak açıldığında çalışır.
export function isMockEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true";
}

export function activeProviderName(): string {
  return process.env.PAYMENT_PROVIDER || "mock";
}

export function getPaymentProvider(name = activeProviderName()): PaymentProvider {
  const provider = providers[name];
  if (!provider) throw new ProviderUnavailableError(`Bilinmeyen ödeme sağlayıcısı: ${name}`);
  if (name === "mock" && !isMockEnabled()) {
    throw new ProviderUnavailableError("Sahte ödeme canlıda kapalıdır");
  }
  return provider;
}

export * from "./types";
