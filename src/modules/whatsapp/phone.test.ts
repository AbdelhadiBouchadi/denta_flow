import { describe, expect, it } from "vitest";

import { maskPhone, toWhatsAppNumber, waMeLink } from "./phone";

describe("toWhatsAppNumber", () => {
  it.each([
    ["+212612345678", "212612345678"],
    ["+212 6 12 34 56 78", "212612345678"],
    ["00212712345678", "212712345678"],
    ["212612345678", "212612345678"],
    ["0612345678", "212612345678"],
    ["07.12.34.56.78", "212712345678"],
    ["(06) 12-34-56-78", "212612345678"],
  ])("normalises %s", (raw, digits) => {
    expect(toWhatsAppNumber(raw)).toEqual({ ok: true, digits });
  });

  it.each(["0528843217", "+212528843217", "0812345678", "00212812345678"])(
    "refuses the landline %s",
    (raw) => {
      expect(toWhatsAppNumber(raw)).toEqual({ ok: false, reason: "fixe" });
    },
  );

  it("accepts another country's E.164 number", () => {
    expect(toWhatsAppNumber("+33 6 12 34 56 78")).toEqual({
      ok: true,
      digits: "33612345678",
    });
  });

  it.each([
    ["too short", "+3361"],
    ["too long", "+1234567890123456"],
    ["letters", "06 12 AB 56 78"],
    ["a short national", "061234"],
    ["a Moroccan number of the wrong length", "+21261234567"],
    ["empty", "   "],
    ["no country code", "612345678"],
  ])("refuses %s", (_label, raw) => {
    expect(toWhatsAppNumber(raw)).toEqual({ ok: false, reason: "invalide" });
  });
});

describe("maskPhone", () => {
  it("shows only the first and last two digits of a mobile", () => {
    expect(maskPhone("+212612345678")).toBe("06 ** ** ** 78");
  });

  it("never prints the middle digits of any number", () => {
    const masked = maskPhone("+33612345678");
    expect(masked).not.toContain("123456");
    expect(masked.startsWith("33")).toBe(true);
    expect(masked.endsWith("78")).toBe(true);
  });
});

describe("waMeLink", () => {
  it("encodes the text", () => {
    expect(waMeLink("212612345678", "Bonjour Karim, à 14:30 ?")).toBe(
      "https://wa.me/212612345678?text=Bonjour%20Karim%2C%20%C3%A0%2014%3A30%20%3F",
    );
  });
});
