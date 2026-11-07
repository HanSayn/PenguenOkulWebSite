import { describe, expect, it } from "vitest";
import { mockProvider, signMockWebhook } from "@/lib/payments/mock";
import { WebhookSignatureError } from "@/lib/payments/types";

const body = JSON.stringify({ providerRef: "mock_abc", outcome: "SUCCEEDED" });
const headers = (sig: string) => new Headers({ "x-mock-signature": sig });

describe("ödeme webhook imzası", () => {
  it("doğru imza kabul edilir", async () => {
    const parsed = await mockProvider.parseWebhook(body, headers(signMockWebhook(body)));
    expect(parsed).toMatchObject({ providerRef: "mock_abc", outcome: "SUCCEEDED" });
  });
  it("imzasız ve yanlış imzalı istek reddedilir", async () => {
    await expect(mockProvider.parseWebhook(body, new Headers())).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(mockProvider.parseWebhook(body, headers("00".repeat(32)))).rejects.toBeInstanceOf(WebhookSignatureError);
  });
  it("gövde değişirse imza geçersiz olur", async () => {
    const sig = signMockWebhook(body);
    const tampered = JSON.stringify({ providerRef: "mock_abc", outcome: "FAILED" });
    await expect(mockProvider.parseWebhook(tampered, headers(sig))).rejects.toBeInstanceOf(WebhookSignatureError);
  });
  it("geçersiz sonuç değeri reddedilir (imza doğru olsa bile)", async () => {
    const bad = JSON.stringify({ providerRef: "mock_abc", outcome: "BEDAVA" });
    await expect(mockProvider.parseWebhook(bad, headers(signMockWebhook(bad)))).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});
