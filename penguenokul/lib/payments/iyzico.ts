import { createHmac, randomBytes } from "node:crypto";
import { ProviderUnavailableError, WebhookSignatureError, type PaymentProvider, type WebhookResult } from "./types";

// iyzico Ortak Ödeme Sayfası (Checkout Form) entegrasyonu.
// Akış: initialize → paymentPageUrl'e yönlendir → iyzico kullanıcıyı callbackUrl'e `token` ile POST eder →
// token ile sonucu iyzico'dan SORGULA (detail) → paket tanımla. Karar, gelen isteğe değil, sorgu yanıtına dayanır.
// Kaynak: docs.iyzico.com (HMACSHA256 kimlik doğrulama, CF initialize/retrieve, Refund V2, yanıt imzası).
// Gerekli ortam değişkenleri: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL (varsayılan: sandbox), APP_URL.

const TIMEOUT_MS = 15_000;
const INIT_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const DETAIL_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";
const REFUND_PATH = "/v2/payment/refund";

function config() {
  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  if (!apiKey || !secretKey) throw new ProviderUnavailableError("iyzico anahtarları tanımlı değil");
  const baseUrl = (process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com").replace(/\/+$/, "");
  return { apiKey, secretKey, baseUrl };
}

const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

// IYZWSv2: base64("apiKey:..&randomKey:..&signature:..") ; imza = HMAC-SHA256(randomKey + uriPath + gövde)
export function authorizationHeader(apiKey: string, secretKey: string, randomKey: string, uriPath: string, body: string): string {
  const signature = hmacHex(secretKey, randomKey + uriPath + body);
  return "IYZWSv2 " + Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`, "utf8").toString("base64");
}

// Yanıt imzası: değerler ":" ile birleştirilir; price/paidPrice sondaki sıfırları atılır ("50.00" → "50").
const trimZeros = (v: string) => (v.includes(".") ? v.replace(/0+$/, "").replace(/\.$/, "") : v);

export function responseSignature(secretKey: string, values: Record<string, unknown>, order: string[]): string {
  const joined = order
    .map((k) => {
      const v = values[k] == null ? "" : String(values[k]);
      return k === "price" || k === "paidPrice" ? trimZeros(v) : v;
    })
    .join(":");
  return hmacHex(secretKey, joined);
}

// İmza alanı varsa doğrulanır; yoksa (eski yanıt biçimi) atlanır: çağrı zaten TLS ve kimlik doğrulamalı bir sunucu çağrısıdır.
function verifyResponse(secretKey: string, res: Record<string, unknown>, order: string[]) {
  if (typeof res.signature !== "string" || !res.signature) return;
  const expected = responseSignature(secretKey, res, order);
  if (expected.length !== res.signature.length || expected !== res.signature.toLowerCase()) {
    throw new WebhookSignatureError("iyzico yanıt imzası geçersiz");
  }
}

type IyzResponse = Record<string, unknown> & { status?: string; errorCode?: string; errorMessage?: string };

async function call(path: string, payload: Record<string, unknown>): Promise<IyzResponse> {
  const { apiKey, secretKey, baseUrl } = config();
  const body = JSON.stringify(payload); // imzalanan metin, gönderilen metinle bire bir aynı olmalı
  const randomKey = `${Date.now()}${randomBytes(6).toString("hex")}`;
  const res = await fetch(baseUrl + path, {
    method: "POST",
    headers: {
      Authorization: authorizationHeader(apiKey, secretKey, randomKey, path, body),
      "x-iyzi-rnd": randomKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => null)) as IyzResponse | null;
  if (!json || typeof json !== "object") throw new Error(`iyzico yanıtı çözülemedi (HTTP ${res.status})`);
  return json;
}

const toDecimal = (kurus: number) => (kurus / 100).toFixed(2);
const toKurus = (v: unknown) => Math.round(Number(v) * 100);

function splitName(full: string): { name: string; surname: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { name: parts[0] || "Öğrenci", surname: "Öğrenci" };
  return { name: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] };
}

function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new ProviderUnavailableError("APP_URL tanımlı değil (iyzico geri dönüş adresi için gerekli)");
  return url.replace(/\/+$/, "");
}

// Sorgu yanıtını (detail) kararımıza çevirir.
async function retrieve(token: string): Promise<WebhookResult> {
  const { secretKey } = config();
  const res = await call(DETAIL_PATH, { locale: "tr", token });

  // API düzeyinde hata (geçici sorun, bilinmeyen token...): karar verme, çağıran tekrar denesin / mutabakat çözsün
  if (res.status !== "success") throw new Error(`iyzico sorgu hatası: ${res.errorCode ?? "?"} ${res.errorMessage ?? ""}`.trim());

  verifyResponse(secretKey, res, ["paymentStatus", "paymentId", "currency", "basketId", "conversationId", "paidPrice", "price", "token"]);

  const base = {
    providerRef: token,
    providerPaymentId: res.paymentId != null ? String(res.paymentId) : undefined,
    amount: toKurus(res.price),
  };
  const fraud = String(res.fraudStatus ?? "");

  if (res.paymentStatus === "SUCCESS" && fraud === "1") return { ...base, outcome: "SUCCEEDED" };
  if (res.paymentStatus === "SUCCESS" && fraud === "0") return { ...base, outcome: "PENDING" }; // dolandırıcılık incelemesi
  if (res.paymentStatus === "SUCCESS" && fraud === "-1") {
    return { ...base, outcome: "FAILED", failureReason: "Ödeme güvenlik denetiminden geçemedi" };
  }
  return { ...base, outcome: "FAILED", failureReason: String(res.errorMessage || "Ödeme tamamlanamadı") };
}

function tokenFrom(rawBody: string, contentType: string): string {
  let token = "";
  if (contentType.includes("json")) {
    try { token = String((JSON.parse(rawBody) as { token?: unknown }).token ?? ""); } catch { /* aşağıda reddedilir */ }
  } else {
    token = new URLSearchParams(rawBody).get("token") ?? "";
  }
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(token)) throw new Error("iyzico geri dönüşünde geçerli token yok");
  return token;
}

export const iyzicoProvider: PaymentProvider = {
  name: "iyzico",
  browserCallback: true,

  async createCheckout(input) {
    const { secretKey } = config();
    const { name, surname } = splitName(input.buyer.name);
    const price = toDecimal(input.amount);
    const address = { address: "Online hizmet (adres gerektirmeyen dijital ürün)", contactName: input.buyer.name, city: "Istanbul", country: "Turkey" };

    const res = await call(INIT_PATH, {
      locale: "tr",
      conversationId: input.paymentId,
      price,
      paidPrice: price,
      currency: input.currency,
      basketId: input.paymentId,
      paymentGroup: "PRODUCT",
      callbackUrl: `${appUrl()}/api/odeme/webhook/iyzico`,
      enabledInstallments: [1], // taksit farkı olmasın: tahsilat tutarı = paket fiyatı
      buyer: {
        id: input.buyer.id,
        name,
        surname,
        // Kimlik numarası toplamıyoruz (KVKK); iyzico alanı zorunlu tuttuğu için yer tutucu gönderilir.
        identityNumber: process.env.IYZICO_IDENTITY_PLACEHOLDER || "11111111111",
        email: input.buyer.email,
        gsmNumber: input.buyer.phone || process.env.IYZICO_PHONE_PLACEHOLDER || "+905000000000",
        registrationAddress: address.address,
        city: address.city,
        country: address.country,
        ...(input.buyer.ip ? { ip: input.buyer.ip } : {}),
      },
      shippingAddress: address,
      billingAddress: address,
      basketItems: [{ id: input.paymentId, name: input.description.slice(0, 100), category1: "Online Ders", itemType: "VIRTUAL", price }],
    });

    if (res.status !== "success") throw new Error(`iyzico ödeme formu açılamadı: ${res.errorCode ?? "?"} ${res.errorMessage ?? ""}`.trim());
    verifyResponse(secretKey, res, ["conversationId", "token"]);

    const token = String(res.token ?? "");
    const url = String(res.paymentPageUrl ?? "");
    if (!token || !/^https:\/\//.test(url)) throw new Error("iyzico yanıtında token ya da ödeme sayfası adresi yok");
    return { providerRef: token, redirectUrl: url };
  },

  // iyzico, kullanıcıyı callbackUrl'e `token` ile yönlendirir. Gövde imzalı değildir; bu yüzden token ile
  // sonuç doğrudan iyzico'dan sorgulanır ve karar o yanıta göre verilir (taklit edilmiş bir istek bir şey kazandıramaz).
  async parseWebhook(rawBody, headers) {
    return retrieve(tokenFrom(rawBody, headers.get("content-type") ?? ""));
  },

  async queryStatus(providerRef) {
    return retrieve(providerRef);
  },

  async refund({ providerPaymentId, amount }) {
    if (!providerPaymentId) throw new Error("iyzico iadesi için sağlayıcı ödeme kimliği (paymentId) kayıtlı değil");
    const res = await call(REFUND_PATH, {
      locale: "tr",
      conversationId: `refund-${providerPaymentId}`,
      paymentId: providerPaymentId,
      price: toDecimal(amount),
      currency: "TRY",
      ip: "127.0.0.1",
    });
    if (res.status !== "success") throw new Error(`iyzico iadesi başarısız: ${res.errorCode ?? "?"} ${res.errorMessage ?? ""}`.trim());
    return { refundRef: String(res.refundHostReference || res.hostReference || res.paymentId || providerPaymentId) };
  },
};
