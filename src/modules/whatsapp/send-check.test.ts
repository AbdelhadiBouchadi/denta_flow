import { describe, expect, it } from "vitest";

import { clinicInstant } from "@/lib/time";
import { isSandboxSender, resolveMode, type EnvPresence } from "./mode";
import { settingsUpdateSchema } from "./schemas";
import { checkClaimedRow, type ClaimedRow } from "./send-check";
import {
  WhatsappEvent as E,
  WhatsappMode,
  WhatsappSkipReason as R,
} from "./types";

const startsAt = clinicInstant("2026-10-15", "15:00");

const row = (overrides: Partial<ClaimedRow> = {}): ClaimedRow => ({
  event: E.Reminder,
  forStartsAt: startsAt,
  appointment: { status: "planned", startsAt },
  patient: { firstName: "Karim", phone: "+212612345678", consent: "granted" },
  clinic: { name: "Cabinet", phone: "+212528843217" },
  rule: { enabled: true },
  template: { contentSid: null, manualText: "Bonjour {prenom}", isActive: true },
  window: { windowStart: "09:00", windowEnd: "19:00", minLeadMinutes: 120 },
  now: clinicInstant("2026-10-14", "15:00"),
  ...overrides,
});

describe("checkClaimedRow — the send-time authority", () => {
  it("sends when everything holds, with the first name only", () => {
    const check = checkClaimedRow(row());
    expect(check).toMatchObject({ action: "send", to: "212612345678" });
    if (check.action === "send") {
      expect(check.params.firstName).toBe("Karim");
      expect(check.params.time).toBe("15:00");
    }
  });

  it("cancels a reminder for an appointment canceled meanwhile", () => {
    expect(
      checkClaimedRow(row({ appointment: { status: "canceled", startsAt } })),
    ).toEqual({ action: "cancel", reason: R.AppointmentStatus });
  });

  it("cancels a reminder whose appointment moved (superseded)", () => {
    expect(
      checkClaimedRow(
        row({ appointment: { status: "planned", startsAt: clinicInstant("2026-10-16", "15:00") } }),
      ),
    ).toEqual({ action: "cancel", reason: R.Superseded });
  });

  it("sends a cancellation only for a canceled appointment, with the canceled slot", () => {
    const check = checkClaimedRow(
      row({ event: E.Cancellation, appointment: { status: "canceled", startsAt } }),
    );
    expect(check.action).toBe("send");
    if (check.action === "send") expect(check.params.date).toBe("jeudi 15 octobre");
    expect(checkClaimedRow(row({ event: E.Cancellation }))).toEqual({
      action: "cancel",
      reason: R.AppointmentStatus,
    });
  });

  it("cancels when the rule is gone or disabled", () => {
    expect(checkClaimedRow(row({ rule: null }))).toEqual({ action: "cancel", reason: R.Superseded });
    expect(checkClaimedRow(row({ rule: { enabled: false } }))).toEqual({
      action: "cancel",
      reason: R.Superseded,
    });
  });

  it.each(["unknown", "declined"])("skips consent «%s»", (consent) => {
    expect(
      checkClaimedRow(row({ patient: { firstName: "K", phone: "+212612345678", consent } })),
    ).toEqual({ action: "skip", reason: R.NoConsent });
  });

  it("skips a landline and an invalid number", () => {
    expect(
      checkClaimedRow(row({ patient: { firstName: "K", phone: "0528843217", consent: "granted" } })),
    ).toEqual({ action: "skip", reason: R.Landline });
    expect(
      checkClaimedRow(row({ patient: { firstName: "K", phone: "12", consent: "granted" } })),
    ).toEqual({ action: "skip", reason: R.InvalidPhone });
  });

  it("skips when the clinic has no phone", () => {
    expect(checkClaimedRow(row({ clinic: { name: "C", phone: " " } }))).toEqual({
      action: "skip",
      reason: R.ClinicPhoneMissing,
    });
  });

  it("reschedules outside the window, skips past the lead", () => {
    expect(checkClaimedRow(row({ now: clinicInstant("2026-10-14", "21:00") }))).toEqual({
      action: "reschedule",
      at: clinicInstant("2026-10-15", "09:00"),
    });
    expect(checkClaimedRow(row({ now: clinicInstant("2026-10-15", "13:30") }))).toEqual({
      action: "skip",
      reason: R.TooLate,
    });
  });
});

const present: EnvPresence = {
  TWILIO_ACCOUNT_SID: true,
  TWILIO_AUTH_TOKEN: true,
  TWILIO_WHATSAPP_FROM: true,
  CRON_SECRET: true,
  NEXT_PUBLIC_APP_URL: true,
};

describe("mode", () => {
  it("detects the shared sandbox sender", () => {
    expect(isSandboxSender("whatsapp:+14155238886")).toBe(true);
    expect(isSandboxSender("whatsapp:+212600000000")).toBe(false);
    expect(isSandboxSender(null)).toBe(false);
  });

  it("is automatic only with a complete env AND the switch on", () => {
    const from = "whatsapp:+212600000000";
    expect(resolveMode({ presence: present, from, enabled: true })).toBe(WhatsappMode.Automatic);
    expect(resolveMode({ presence: present, from, enabled: false })).toBe(WhatsappMode.Manual);
    expect(
      resolveMode({ presence: { ...present, CRON_SECRET: false }, from, enabled: true }),
    ).toBe(WhatsappMode.Manual);
    expect(
      resolveMode({ presence: present, from: "whatsapp:+14155238886", enabled: true }),
    ).toBe(WhatsappMode.Sandbox);
  });
});

describe("settingsUpdateSchema", () => {
  const valid = { enabled: false, windowStart: "09:00", windowEnd: "19:00", minLeadMinutes: 120 };

  it("accepts the defaults", () => {
    expect(settingsUpdateSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses a window that ends before it starts", () => {
    const result = settingsUpdateSchema.safeParse({ ...valid, windowEnd: "08:00" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["windowEnd"]);
  });

  it("refuses a malformed time and an out-of-range lead", () => {
    expect(settingsUpdateSchema.safeParse({ ...valid, windowStart: "9h" }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...valid, minLeadMinutes: 1441 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...valid, minLeadMinutes: -1 }).success).toBe(false);
  });
});
