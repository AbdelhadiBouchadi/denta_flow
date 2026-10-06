import { describe, expect, it } from "vitest";

import { COLOR_PALETTE } from "@/components/shared/color-palette";
import {
  getTagIcon,
  TAG_ICON_NAMES,
  TAG_ICONS,
  TAG_VALIDATION_MESSAGES,
  tagRemoveConfirmDescription,
} from "./constants";
import { tagFormSchema, tagUpdateSchema } from "./schemas";

const valid = { label: "Urgent", color: "#DC2626", icon: "siren" };

const firstMessage = (input: unknown) => {
  const result = tagFormSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("tagFormSchema", () => {
  it("trims the label", () => {
    expect(tagFormSchema.parse({ ...valid, label: "  VIP  " }).label).toBe(
      "VIP",
    );
  });

  it("requires a label, whitespace included", () => {
    expect(firstMessage({ ...valid, label: "" })).toBe(
      TAG_VALIDATION_MESSAGES.labelRequired,
    );
    expect(firstMessage({ ...valid, label: "   " })).toBe(
      TAG_VALIDATION_MESSAGES.labelRequired,
    );
  });

  it("accepts every palette colour, lower-case included", () => {
    for (const swatch of COLOR_PALETTE) {
      expect(
        tagFormSchema.parse({ ...valid, color: swatch.value.toLowerCase() })
          .color,
      ).toBe(swatch.value);
    }
  });

  it("refuses a colour outside the palette", () => {
    expect(firstMessage({ ...valid, color: "#DB2777" })).toBe(
      TAG_VALIDATION_MESSAGES.colorInvalid,
    );
    expect(firstMessage({ ...valid, color: "red" })).toBe(
      TAG_VALIDATION_MESSAGES.colorInvalid,
    );
  });

  it("accepts every key of the curated icon map", () => {
    for (const name of TAG_ICON_NAMES) {
      expect(tagFormSchema.parse({ ...valid, icon: name }).icon).toBe(name);
    }
  });

  it("refuses an icon that is not a key of the curated map", () => {
    expect(firstMessage({ ...valid, icon: "rocket" })).toBe(
      TAG_VALIDATION_MESSAGES.iconInvalid,
    );
    expect(firstMessage({ ...valid, icon: "toString" })).toBe(
      TAG_VALIDATION_MESSAGES.iconInvalid,
    );
  });

  it("stores no icon as null, whether omitted, empty or null", () => {
    expect(tagFormSchema.parse({ ...valid, icon: "" }).icon).toBeNull();
    expect(tagFormSchema.parse({ ...valid, icon: null }).icon).toBeNull();
    expect(
      tagFormSchema.parse({ label: "VIP", color: "#0D9488" }).icon,
    ).toBeNull();
  });

  it("requires an id on update", () => {
    expect(tagUpdateSchema.safeParse(valid).success).toBe(false);
    expect(tagUpdateSchema.safeParse({ ...valid, id: "t1" }).success).toBe(
      true,
    );
  });
});

describe("curated icon map", () => {
  it("has exactly one component per allowed name", () => {
    expect(Object.keys(TAG_ICONS).sort()).toEqual([...TAG_ICON_NAMES].sort());
  });

  it("resolves an unknown or empty stored name to no icon", () => {
    expect(getTagIcon("siren")).toBe(TAG_ICONS.siren);
    expect(getTagIcon("rocket")).toBeNull();
    expect(getTagIcon("constructor")).toBeNull();
    expect(getTagIcon(null)).toBeNull();
    expect(getTagIcon("")).toBeNull();
  });
});

describe("tagRemoveConfirmDescription", () => {
  it("pluralises the patient count", () => {
    expect(tagRemoveConfirmDescription("VIP", 1)).toBe(
      "Supprimer le tag « VIP » ? Il sera retiré de 1 patient.",
    );
    expect(tagRemoveConfirmDescription("VIP", 3)).toBe(
      "Supprimer le tag « VIP » ? Il sera retiré de 3 patients.",
    );
  });

  it("says so when no patient carries the tag", () => {
    expect(tagRemoveConfirmDescription("VIP", 0)).toBe(
      "Supprimer le tag « VIP » ? Aucun patient ne le porte.",
    );
  });
});
