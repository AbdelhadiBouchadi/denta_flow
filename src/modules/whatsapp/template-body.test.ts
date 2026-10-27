import { describe, expect, it } from "vitest";

import {
  CHIP_SAMPLES,
  DEFAULT_BODIES,
  EVENT_VALUES,
  TEMPLATE_BODY_MAX,
  WHATSAPP_VALIDATION as V,
} from "./constants";
import { templateFormSchema } from "./schemas";
import {
  bodyErrors,
  contentVariablesFor,
  fromCanonical,
  isPromotional,
  MalformedBodyError,
  renderCanonical,
  renderSegments,
  toCanonical,
} from "./template-body";
import { MessageChip as C, WhatsappEvent as E, type BodySegment } from "./types";

const t = (text: string): BodySegment => ({ type: "text", text });
const c = (chip: C): BodySegment => ({ type: "chip", chip });

describe("toCanonical / fromCanonical", () => {
  it("numbers 33's default reminder 1 to 5 in 33's order", () => {
    const canonical = toCanonical(DEFAULT_BODIES[E.Reminder]);
    expect(canonical.variables).toEqual([C.FirstName, C.Date, C.Time, C.ClinicName, C.ClinicPhone]);
    expect(canonical.body).toBe(
      "Bonjour {{1}}, nous vous rappelons votre rendez-vous le {{2}} à {{3}} au {{4}}. Pour le modifier ou l’annuler, appelez le {{5}}.",
    );
  });

  it("numbers by first appearance — sequential even without «Prénom»", () => {
    const canonical = toCanonical([t("Le "), c(C.Date), t(" à "), c(C.Time), t(", le "), c(C.Date), t(".")]);
    expect(canonical).toEqual({
      body: "Le {{1}} à {{2}}, le {{1}}.",
      variables: [C.Date, C.Time],
    });
  });

  it("round-trips every default body", () => {
    for (const event of EVENT_VALUES) {
      const segments = DEFAULT_BODIES[event];
      expect(fromCanonical(toCanonical(segments))).toEqual(segments);
    }
  });

  it("merges neighbouring texts and drops empty ones", () => {
    expect(toCanonical([t("Bon"), t("jour "), t(""), c(C.FirstName), t(".")]).body).toBe(
      "Bonjour {{1}}.",
    );
  });

  it("refuses braces typed as text — no forged placeholder", () => {
    expect(() => toCanonical([t("Bonjour {{1}} "), c(C.Date), t(".")])).toThrow(MalformedBodyError);
  });

  it("refuses a stored number with no chip behind it", () => {
    expect(() => fromCanonical({ body: "Bonjour {{2}}.", variables: [C.FirstName] })).toThrow(
      MalformedBodyError,
    );
    expect(() => fromCanonical({ body: "Bonjour {x}.", variables: [] })).toThrow(MalformedBodyError);
  });
});

describe("rendering", () => {
  it("renders the preview with the sample values", () => {
    expect(renderSegments(DEFAULT_BODIES[E.Cancellation], CHIP_SAMPLES)).toBe(
      "Bonjour Karim, votre rendez-vous du mercredi 15 octobre à 14:30 au Cabinet Dentaire Dr Amrani a été annulé. Pour reprendre rendez-vous, appelez le 05 28 84 32 17.",
    );
  });

  it("renders the canonical body to the same text", () => {
    const segments = DEFAULT_BODIES[E.Reschedule];
    expect(renderCanonical(toCanonical(segments), CHIP_SAMPLES)).toBe(
      renderSegments(segments, CHIP_SAMPLES),
    );
  });

  it("builds variables for exactly the numbers a body uses", () => {
    expect(contentVariablesFor([C.Date, C.Time], CHIP_SAMPLES)).toEqual({
      "1": "mercredi 15 octobre",
      "2": "14:30",
    });
  });
});

describe("bodyErrors — WhatsApp's rules, in French", () => {
  it("accepts every default body", () => {
    for (const event of EVENT_VALUES) {
      expect(bodyErrors(DEFAULT_BODIES[event], event)).toEqual([]);
    }
  });

  it("requires «Date» and «Heure» for rappel, confirmation and modification", () => {
    const noTime = [t("Bonjour, votre rendez-vous du "), c(C.Date), t(" est confirmé.")];
    expect(bodyErrors(noTime, E.Reminder)).toContain(V.bodyDateTime);
    expect(bodyErrors(noTime, E.Confirmation)).toContain(V.bodyDateTime);
    expect(bodyErrors(noTime, E.Reschedule)).toContain(V.bodyDateTime);
    // Not every chip: a message without «Prénom» or «Téléphone» is fine.
    expect(bodyErrors([t("Le "), c(C.Date), t(" à "), c(C.Time), t(".")], E.Reminder)).toEqual([]);
  });

  it("does not require them for an annulation", () => {
    expect(bodyErrors([t("Votre rendez-vous est annulé.")], E.Cancellation)).toEqual([]);
  });

  it("refuses an empty message", () => {
    expect(bodyErrors([], E.Cancellation)).toEqual([V.bodyRequired]);
    expect(bodyErrors([t("   ")], E.Cancellation)).toEqual([V.bodyRequired]);
  });

  it("refuses braces from user text", () => {
    expect(bodyErrors([t("Bonjour {prenom}, annulé.")], E.Cancellation)).toContain(V.bodyBraces);
    expect(bodyErrors([t("Bonjour {{1}}, annulé.")], E.Cancellation)).toContain(V.bodyBraces);
  });

  it("refuses a chip at the start or the end", () => {
    expect(bodyErrors([c(C.FirstName), t(", annulé.")], E.Cancellation)).toContain(V.bodyEdgeChip);
    expect(bodyErrors([t("  "), c(C.FirstName), t(", annulé.")], E.Cancellation)).toContain(
      V.bodyEdgeChip,
    );
    expect(bodyErrors([t("Appelez le "), c(C.ClinicPhone)], E.Cancellation)).toContain(
      V.bodyEdgeChip,
    );
  });

  it("refuses two chips without a word between them", () => {
    expect(
      bodyErrors([t("Le "), c(C.Date), t(", "), c(C.Time), t(".")], E.Reminder),
    ).toContain(V.bodyAdjacentChips);
    expect(bodyErrors([t("Le "), c(C.Date), t(" à "), c(C.Time), t(".")], E.Reminder)).toEqual([]);
  });

  it("refuses line breaks, tabs and more than four spaces", () => {
    expect(bodyErrors([t("Annulé.\nÀ bientôt")], E.Cancellation)).toContain(V.bodyLineBreak);
    expect(bodyErrors([t("Annulé.\tÀ bientôt")], E.Cancellation)).toContain(V.bodyLineBreak);
    expect(bodyErrors([t("Annulé.     À bientôt")], E.Cancellation)).toContain(V.bodySpaces);
    expect(bodyErrors([t("Annulé.    À bientôt")], E.Cancellation)).toEqual([]);
  });

  it("caps the canonical body at the WhatsApp limit", () => {
    const at = (length: number) => [t("x".repeat(length))];
    expect(bodyErrors(at(TEMPLATE_BODY_MAX), E.Cancellation)).toEqual([]);
    expect(bodyErrors(at(TEMPLATE_BODY_MAX + 1), E.Cancellation)).toContain(V.bodyTooLong);
    // Counted on the canonical body: each chip weighs «{{n}}», 5 characters.
    const withChips = [
      t("x".repeat(TEMPLATE_BODY_MAX - 7)),
      c(C.Date),
      t(" à "),
      c(C.Time),
      t("."),
    ];
    expect(bodyErrors(withChips, E.Reminder)).toContain(V.bodyTooLong);
  });

  it("is what the form schema reports, on `segments`", () => {
    const result = templateFormSchema.safeParse({
      name: "Rappel",
      kind: E.Reminder,
      segments: [c(C.Date), t(" à "), c(C.Time)],
      isActive: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.every((issue) => issue.path[0] === "segments")).toBe(true);
  });

  it("rejects an unknown chip at the schema", () => {
    const result = templateFormSchema.safeParse({
      name: "Rappel",
      kind: E.Cancellation,
      segments: [t("Bonjour "), { type: "chip", chip: "surname" }, t(".")],
      isActive: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("isPromotional", () => {
  it("warns on marketing wording, whole words only", () => {
    expect(isPromotional([t("Profitez de -20 % sur le blanchiment !")])).toBe(true);
    expect(isPromotional([t("Une offre spéciale pour vous.")])).toBe(true);
    expect(isPromotional(DEFAULT_BODIES[E.Reminder])).toBe(false);
    // «offrez» is not «offre», «promotionnel»… is not matched by accident.
    expect(isPromotional([t("Nous vous offrons un rappel.")])).toBe(false);
  });
});
