import { describe, expect, it } from "vitest";
import { buildCsp, newNonce } from "@/lib/csp";

describe("CSP", () => {
  it("script-src nonce kullanır, unsafe-inline içermez", () => {
    const csp = buildCsp("abc123");
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toContain("'nonce-abc123'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
  });
  it("yalnızca geliştirmede unsafe-eval eklenir", () => {
    expect(buildCsp("n", { dev: true })).toContain("'unsafe-eval'");
    expect(buildCsp("n", { dev: false })).not.toContain("'unsafe-eval'");
  });
  it("çerçeveleme ve eklenti kapalı, görüşme sağlayıcısı izinli", () => {
    const csp = buildCsp("n", { frameHost: "meet.example.com" });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src https://meet.example.com");
    expect(csp).not.toContain("form-action");
  });
  it("her çağrıda farklı, yeterince uzun nonce üretir", () => {
    const a = newNonce(), b = newNonce();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(22);
  });
});
