import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { authorizationHeader, iyzicoProvider, responseSignature } from "@/lib/payments/iyzico";
import { ProviderUnavailableError, WebhookSignatureError } from "@/lib/payments/types";

const SECRET = "sandbox-secret";
const hmac = (data: string) => createHmac("sha256", SECRET).update(data).digest("hex");

beforeEach(() => {
  process.env.IYZICO_API_KEY = "sandbox-api";
  process.env.IYZICO_SECRET_KEY = SECRET;
  process.env.APP_URL = "https://penguenokul.example";
  delete process.env.IYZICO_BASE_URL;
});
afterEach(() => vi.unstubAllGlobals());

// fetch'i taklit eder; yapılan çağrıları kaydeder
function stubFetch(handler: (url: string, init: RequestInit) => unknown) {
  const calls: { url: string; init: RequestInit; body: any }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    const out = handler(url, init);
    return { status: 200, json: async () => out };
  });
  return calls;
}

describe("IYZWSv2 kimlik doğrulama", () => {
  it("bağımsız (Python) uygulamayla aynı başlığı üretir", () => {
    const header = authorizationHeader("sandbox-api", SECRET, "1722246017090123456789", "/payment/bin/check", '{"binNumber":"535805","locale":"tr"}');
    expect(header).toBe(
      "IYZWSv2 YXBpS2V5OnNhbmRib3gtYXBpJnJhbmRvbUtleToxNzIyMjQ2MDE3MDkwMTIzNDU2Nzg5JnNpZ25hdHVyZTplNjljZmQzNTRhN2Q2NDg1ZTUyYjA2OWZkN2E2Y2ZiOGYyY2M0ZmE5ZDdkMGYyYWU5MzJmMTVmMWMyZTJkOGI5"
    );
  });

  it("gönderilen istekte imza, gerçekte gönderilen gövdeyle doğrulanabilir", async () => {
    const calls = stubFetch(() => ({ status: "success", token: "tok_abcdefgh", paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=tok_abcdefgh" }));
    await iyzicoProvider.createCheckout({ paymentId: "pay1", amount: 240000, currency: "TRY", description: "3 Aylık Paket (24 ders)", buyer: { id: "u1", email: "a@b.co", name: "Ayşe Yılmaz" } });
    const { init } = calls[0];
    const headers = init.headers as Record<string, string>;
    const decoded = Buffer.from(headers.Authorization.replace("IYZWSv2 ", ""), "base64").toString("utf8");
    const m = /^apiKey:(.+)&randomKey:(.+)&signature:([0-9a-f]{64})$/.exec(decoded)!;
    expect(m[1]).toBe("sandbox-api");
    expect(m[2]).toBe(headers["x-iyzi-rnd"]);
    expect(m[3]).toBe(hmac(m[2] + "/payment/iyzipos/checkoutform/initialize/auth/ecom" + String(init.body)));
  });
});

describe("yanıt imzası", () => {
  it("alanları ':' ile birleştirir ve price'ın sondaki sıfırlarını atar", () => {
    const res = { paymentStatus: "SUCCESS", paymentId: "12345", currency: "TRY", basketId: "basket1", conversationId: "conv1", paidPrice: "2400.00", price: "2400.0", token: "tok_abc123" };
    const order = ["paymentStatus", "paymentId", "currency", "basketId", "conversationId", "paidPrice", "price", "token"];
    expect(responseSignature(SECRET, res, order)).toBe("d9fe07374ce8fc9966594d5c89b5ff0c74bdf2ecdd4021a816d4d176acce0252");
  });
});

describe("createCheckout", () => {
  const input = { paymentId: "pay1", amount: 125050, currency: "TRY" as const, description: "Deneme Paketi (4 ders)", buyer: { id: "u1", email: "a@b.co", name: "Ayşe Nur Yılmaz", phone: "+905321234567", ip: "1.2.3.4" } };

  it("doğru uca, doğru gövdeyle istek atar ve ödeme sayfasına yönlendirir", async () => {
    const calls = stubFetch(() => ({ status: "success", token: "tok_abcdefgh", paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=tok_abcdefgh" }));
    const out = await iyzicoProvider.createCheckout(input);
    expect(out).toEqual({ providerRef: "tok_abcdefgh", redirectUrl: "https://sandbox-cpp.iyzipay.com?token=tok_abcdefgh" });
    expect(calls[0].url).toBe("https://sandbox-api.iyzipay.com/payment/iyzipos/checkoutform/initialize/auth/ecom");
    const b = calls[0].body;
    expect(b).toMatchObject({
      price: "1250.50", // kuruş yuvarlanmadan
      paidPrice: "1250.50",
      currency: "TRY",
      basketId: "pay1",
      conversationId: "pay1",
      callbackUrl: "https://penguenokul.example/api/odeme/webhook/iyzico",
      enabledInstallments: [1],
    });
    expect(b.buyer).toMatchObject({ id: "u1", name: "Ayşe Nur", surname: "Yılmaz", email: "a@b.co", gsmNumber: "+905321234567", ip: "1.2.3.4" });
    expect(b.basketItems).toEqual([{ id: "pay1", name: "Deneme Paketi (4 ders)", category1: "Online Ders", itemType: "VIRTUAL", price: "1250.50" }]);
  });

  it("tek kelimelik isimde soyad yer tutucu alır, telefon yoksa yer tutucu gider", async () => {
    const calls = stubFetch(() => ({ status: "success", token: "tok_abcdefgh", paymentPageUrl: "https://x.iyzipay.com/p" }));
    await iyzicoProvider.createCheckout({ ...input, buyer: { id: "u1", email: "a@b.co", name: "Ayşe" } });
    expect(calls[0].body.buyer.surname).toBe("Öğrenci");
    expect(calls[0].body.buyer.gsmNumber).toBe("+905000000000");
    expect(calls[0].body.buyer.ip).toBeUndefined();
  });

  it("canlı adres IYZICO_BASE_URL ile seçilir", async () => {
    process.env.IYZICO_BASE_URL = "https://api.iyzipay.com/";
    const calls = stubFetch(() => ({ status: "success", token: "tok_abcdefgh", paymentPageUrl: "https://x.iyzipay.com/p" }));
    await iyzicoProvider.createCheckout(input);
    expect(calls[0].url.startsWith("https://api.iyzipay.com/payment/")).toBe(true);
  });

  it("anahtar ya da APP_URL yoksa güvenli biçimde kapalı kalır", async () => {
    delete process.env.IYZICO_SECRET_KEY;
    await expect(iyzicoProvider.createCheckout(input)).rejects.toBeInstanceOf(ProviderUnavailableError);
    process.env.IYZICO_SECRET_KEY = SECRET;
    delete process.env.APP_URL;
    stubFetch(() => ({}));
    await expect(iyzicoProvider.createCheckout(input)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("hata yanıtı ve https olmayan ödeme sayfası reddedilir", async () => {
    stubFetch(() => ({ status: "failure", errorCode: "11", errorMessage: "Geçersiz istek" }));
    await expect(iyzicoProvider.createCheckout(input)).rejects.toThrow(/Geçersiz istek/);
    stubFetch(() => ({ status: "success", token: "tok_abcdefgh", paymentPageUrl: "http://evil.example/pay" }));
    await expect(iyzicoProvider.createCheckout(input)).rejects.toThrow(/adresi yok/);
  });

  it("imzalı yanıtta imza doğrulanır, bozuk imza reddedilir", async () => {
    const good = { status: "success", conversationId: "pay1", token: "tok_abcdefgh", paymentPageUrl: "https://x.iyzipay.com/p" };
    stubFetch(() => ({ ...good, signature: hmac("pay1:tok_abcdefgh") }));
    await expect(iyzicoProvider.createCheckout(input)).resolves.toBeTruthy();
    stubFetch(() => ({ ...good, signature: "0".repeat(64) }));
    await expect(iyzicoProvider.createCheckout(input)).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});

describe("geri dönüş (parseWebhook)", () => {
  const form = (token: string) => new Headers({ "content-type": "application/x-www-form-urlencoded" });
  const detail = (over: Record<string, unknown> = {}) => ({
    status: "success", paymentStatus: "SUCCESS", fraudStatus: 1, paymentId: "98765", price: 2400, paidPrice: 2400,
    currency: "TRY", basketId: "pay1", conversationId: "", token: "tok_abcdefgh", ...over,
  });

  it("token'ı formdan okur, sonucu iyzico'dan sorgular ve başarılıyı kuruş olarak döndürür", async () => {
    const calls = stubFetch(() => detail());
    const ev = await iyzicoProvider.parseWebhook("token=tok_abcdefgh", form("tok_abcdefgh"));
    expect(ev).toEqual({ providerRef: "tok_abcdefgh", outcome: "SUCCEEDED", providerPaymentId: "98765", amount: 240000 });
    expect(calls[0].url).toBe("https://sandbox-api.iyzipay.com/payment/iyzipos/checkoutform/auth/ecom/detail");
    expect(calls[0].body).toEqual({ locale: "tr", token: "tok_abcdefgh" });
  });

  it("JSON gövdeyi de kabul eder", async () => {
    stubFetch(() => detail());
    const ev = await iyzicoProvider.parseWebhook(JSON.stringify({ token: "tok_abcdefgh" }), new Headers({ "content-type": "application/json" }));
    expect(ev.outcome).toBe("SUCCEEDED");
  });

  it("karar gelen isteğe değil sorgu yanıtına göre verilir: sahte 'başarılı' istek bir şey kazandırmaz", async () => {
    stubFetch(() => detail({ paymentStatus: "FAILURE", errorMessage: "Kart reddedildi" }));
    const ev = await iyzicoProvider.parseWebhook("token=tok_abcdefgh&paymentStatus=SUCCESS&status=success", form(""));
    expect(ev).toMatchObject({ outcome: "FAILED", failureReason: "Kart reddedildi" });
  });

  it("dolandırıcılık incelemesi bekletir, reddi başarısız sayar", async () => {
    stubFetch(() => detail({ fraudStatus: 0 }));
    expect((await iyzicoProvider.parseWebhook("token=tok_abcdefgh", form(""))).outcome).toBe("PENDING");
    stubFetch(() => detail({ fraudStatus: -1 }));
    expect((await iyzicoProvider.parseWebhook("token=tok_abcdefgh", form(""))).outcome).toBe("FAILED");
  });

  it("API düzeyinde hata karar sayılmaz (fırlatır; mutabakat yeniden dener)", async () => {
    stubFetch(() => ({ status: "failure", errorCode: "5", errorMessage: "Sistem hatası" }));
    await expect(iyzicoProvider.parseWebhook("token=tok_abcdefgh", form(""))).rejects.toThrow(/sorgu hatası/);
  });

  it("token yoksa ya da biçimsizse reddedilir", async () => {
    stubFetch(() => detail());
    await expect(iyzicoProvider.parseWebhook("foo=bar", form(""))).rejects.toThrow(/token/);
    await expect(iyzicoProvider.parseWebhook("token=../../etc", form(""))).rejects.toThrow(/token/);
  });

  it("yanıt imzası doğrulanır", async () => {
    const res = detail();
    const sig = responseSignature(SECRET, res, ["paymentStatus", "paymentId", "currency", "basketId", "conversationId", "paidPrice", "price", "token"]);
    stubFetch(() => ({ ...res, signature: sig }));
    await expect(iyzicoProvider.parseWebhook("token=tok_abcdefgh", form(""))).resolves.toMatchObject({ outcome: "SUCCEEDED" });
    stubFetch(() => ({ ...res, signature: "f".repeat(64) }));
    await expect(iyzicoProvider.parseWebhook("token=tok_abcdefgh", form(""))).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});

describe("iade", () => {
  it("V2 ucuna paymentId ve tutarla istek atar, iade referansını döndürür", async () => {
    const calls = stubFetch(() => ({ status: "success", paymentId: "98765", refundHostReference: "RH-1" }));
    const out = await iyzicoProvider.refund({ providerRef: "tok_abcdefgh", providerPaymentId: "98765", amount: 240000 });
    expect(out).toEqual({ refundRef: "RH-1" });
    expect(calls[0].url).toBe("https://sandbox-api.iyzipay.com/v2/payment/refund");
    expect(calls[0].body).toMatchObject({ paymentId: "98765", price: "2400.00", currency: "TRY" });
  });
  it("sağlayıcı ödeme kimliği yoksa ya da iyzico reddederse hata verir", async () => {
    await expect(iyzicoProvider.refund({ providerRef: "t", providerPaymentId: null, amount: 100 })).rejects.toThrow(/paymentId/);
    stubFetch(() => ({ status: "failure", errorCode: "9", errorMessage: "İade edilemez" }));
    await expect(iyzicoProvider.refund({ providerRef: "t", providerPaymentId: "1", amount: 100 })).rejects.toThrow(/İade edilemez/);
  });
});
