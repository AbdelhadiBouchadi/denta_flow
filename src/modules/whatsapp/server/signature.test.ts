import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  computeTwilioSignature,
  verifyBearer,
  verifyTwilioSignature,
} from "./signature";

// The worked example of twilio.com/docs/usage/security.
const DOC = {
  authToken: "12345",
  url: "https://example.com/myapp.php?foo=1&bar=2",
  params: {
    CallSid: "CA1234567890ABCDE",
    Caller: "+14158675310",
    Digits: "1234",
    From: "+14158675310",
    To: "+18005551212",
  },
  signature: "L/OH5YylLD5NRKLltdqwSvS0BnU=",
};

const verify = (overrides: Partial<Parameters<typeof verifyTwilioSignature>[0]>) =>
  verifyTwilioSignature({
    authToken: DOC.authToken,
    url: DOC.url,
    params: DOC.params,
    signature: DOC.signature,
    ...overrides,
  });

describe("Twilio signature", () => {
  it("reproduces the documentation's vector", () => {
    expect(computeTwilioSignature(DOC.authToken, DOC.url, DOC.params)).toBe(
      DOC.signature,
    );
    expect(verify({})).toBe(true);
  });

  it("does not depend on the order the parameters arrive in", () => {
    const reversed = Object.fromEntries(Object.entries(DOC.params).reverse());
    expect(verify({ params: reversed })).toBe(true);
  });

  it("refuses a wrong token", () => {
    expect(verify({ authToken: "54321" })).toBe(false);
  });

  it("refuses a tampered parameter", () => {
    expect(verify({ params: { ...DOC.params, Digits: "1235" } })).toBe(false);
    expect(verify({ params: { ...DOC.params, Extra: "1" } })).toBe(false);
  });

  it("refuses a different URL", () => {
    expect(verify({ url: "https://example.com/myapp.php?foo=1&bar=3" })).toBe(false);
    expect(verify({ url: "http://example.com/myapp.php?foo=1&bar=2" })).toBe(false);
    expect(verify({ url: `${DOC.url}/` })).toBe(false);
  });

  it("refuses a missing header or a missing token", () => {
    expect(verify({ signature: null })).toBe(false);
    expect(verify({ signature: "" })).toBe(false);
    expect(verify({ authToken: "" })).toBe(false);
  });

  it("refuses a signature of another length without throwing", () => {
    expect(verify({ signature: "short" })).toBe(false);
    expect(verify({ signature: `${DOC.signature}AA` })).toBe(false);
  });

  it("compares in constant time, never with ===", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./signature.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain("timingSafeEqual(expected, received)");
    expect(source).not.toMatch(/signature\s*===|===\s*signature/);
    expect(source).not.toMatch(/expected\s*===\s*received/);
  });
});

describe("cron bearer", () => {
  const secret = "a-long-random-cron-secret";

  it("accepts exactly «Bearer <secret>»", () => {
    expect(verifyBearer(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("refuses everything else", () => {
    expect(verifyBearer(null, secret)).toBe(false);
    expect(verifyBearer(secret, secret)).toBe(false);
    expect(verifyBearer(`Bearer ${secret}x`, secret)).toBe(false);
    expect(verifyBearer(`Bearer ${secret}`, undefined)).toBe(false);
    expect(verifyBearer("Bearer ", "")).toBe(false);
  });
});
