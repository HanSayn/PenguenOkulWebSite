import { ProviderUnavailableError, type PaymentProvider } from "./types";

// İskelet: iyzico (Checkout Form) bağlanınca burası doldurulacak.
// Gerekli ortam değişkenleri: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL.
// Akış: createCheckout → initialize checkout form → paymentPageUrl döner;
// parseWebhook → callback token'ı ile sonucu sağlayıcıdan sorgula (imza yerine sunucudan doğrulama).
// Henüz gerçek API çağrısı yoktur; anahtar yoksa güvenli biçimde kapalı kalır.
export const iyzicoProvider: PaymentProvider = {
  name: "iyzico",
  async createCheckout() {
    throw new ProviderUnavailableError("iyzico henüz bağlanmadı");
  },
  async parseWebhook() {
    throw new ProviderUnavailableError("iyzico henüz bağlanmadı");
  },
  async refund() {
    throw new ProviderUnavailableError("iyzico henüz bağlanmadı");
  },
};
