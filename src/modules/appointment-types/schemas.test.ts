import { describe, expect, it } from "vitest";

import { COLOR_PALETTE } from "@/components/shared/color-palette";
import {
  APPOINTMENT_TYPE_VALIDATION_MESSAGES as M,
  formatDuration,
} from "./constants";
import {
  appointmentTypeFormSchema,
  appointmentTypeUpdateSchema,
} from "./schemas";

const valid = {
  label: "Consultation",
  color: "#0D9488",
  defaultDurationMinutes: 30,
};

const firstMessage = (input: unknown) => {
  const result = appointmentTypeFormSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("appointmentTypeFormSchema", () => {
  it("trims the label and requires it", () => {
    expect(
      appointmentTypeFormSchema.parse({ ...valid, label: "  Chirurgie " })
        .label,
    ).toBe("Chirurgie");
    expect(firstMessage({ ...valid, label: "   " })).toBe(M.labelRequired);
  });

  it("accepts every palette colour and nothing else", () => {
    for (const swatch of COLOR_PALETTE) {
      expect(
        appointmentTypeFormSchema.parse({
          ...valid,
          color: swatch.value.toLowerCase(),
        }).color,
      ).toBe(swatch.value);
    }
    expect(firstMessage({ ...valid, color: "#123456" })).toBe(M.colorInvalid);
  });

  it("bounds the duration to an integer from 5 to 480", () => {
    for (const ok of [5, 30, 480]) {
      expect(firstMessage({ ...valid, defaultDurationMinutes: ok })).toBeNull();
    }
    for (const bad of [4, 481, 12.5, Number.NaN]) {
      expect(firstMessage({ ...valid, defaultDurationMinutes: bad })).toBe(
        M.durationInvalid,
      );
    }
  });

  it("requires an id on update", () => {
    expect(appointmentTypeUpdateSchema.safeParse(valid).success).toBe(false);
    expect(
      appointmentTypeUpdateSchema.safeParse({ ...valid, id: "t1" }).success,
    ).toBe(true);
  });
});

describe("formatDuration", () => {
  it("reads minutes and hours in French", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30");
    expect(formatDuration(125)).toBe("2 h 05");
  });
});
