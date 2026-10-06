import { describe, expect, it } from "vitest";

import { serviceCategory } from "@/database/schema";
import { formatDH } from "@/lib/format";
import {
  importResultMessage,
  SERVICE_CATEGORY_LABELS,
  SERVICE_VALIDATION_MESSAGES as M,
} from "./constants";
import {
  ngapImportSchema,
  serviceFormSchema,
  serviceUpdateSchema,
} from "./schemas";
import { SERVICE_CATEGORY_VALUES, ServiceCategory } from "./types";

const valid = {
  label: "Détartrage",
  category: ServiceCategory.Periodontics,
  defaultPriceCents: 30000,
  durationMinutes: 45,
  nomenclatureCode: "D708",
};

const firstMessage = (input: unknown) => {
  const result = serviceFormSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("serviceFormSchema", () => {
  it("accepts a valid act", () => {
    expect(serviceFormSchema.parse(valid)).toEqual(valid);
  });

  it("trims the label and requires it, whitespace included", () => {
    expect(serviceFormSchema.parse({ ...valid, label: "  Pose  " }).label).toBe(
      "Pose",
    );
    expect(firstMessage({ ...valid, label: "" })).toBe(M.labelRequired);
    expect(firstMessage({ ...valid, label: "   " })).toBe(M.labelRequired);
  });

  it("takes the price as integer centimes ≥ 0", () => {
    expect(serviceFormSchema.parse({ ...valid, defaultPriceCents: 0 })
      .defaultPriceCents).toBe(0);
    expect(firstMessage({ ...valid, defaultPriceCents: -1 })).toBe(
      M.priceInvalid,
    );
    expect(firstMessage({ ...valid, defaultPriceCents: 12.5 })).toBe(
      M.priceInvalid,
    );
    // An emptied MoneyInput.
    expect(firstMessage({ ...valid, defaultPriceCents: Number.NaN })).toBe(
      M.priceRequired,
    );
  });

  it("bounds the duration to 5–480 whole minutes", () => {
    for (const minutes of [5, 30, 480]) {
      expect(serviceFormSchema.safeParse({ ...valid, durationMinutes: minutes })
        .success).toBe(true);
    }
    for (const minutes of [4, 481, 0, 30.5, Number.NaN]) {
      expect(firstMessage({ ...valid, durationMinutes: minutes })).toBe(
        M.durationInvalid,
      );
    }
  });

  it("accepts only a category of the enum", () => {
    expect(firstMessage({ ...valid, category: "radiology" })).toBe(
      M.categoryInvalid,
    );
    expect(firstMessage({ ...valid, category: undefined })).toBe(
      M.categoryInvalid,
    );
  });

  it("stores a blank code as null, and trims a set one without format check", () => {
    for (const code of ["", "   ", null, undefined]) {
      expect(
        serviceFormSchema.parse({ ...valid, nomenclatureCode: code })
          .nomenclatureCode,
      ).toBeNull();
    }
    expect(
      serviceFormSchema.parse({ ...valid, nomenclatureCode: " IMPL-01 " })
        .nomenclatureCode,
    ).toBe("IMPL-01");
  });

  it("requires an id on update", () => {
    expect(serviceUpdateSchema.safeParse(valid).success).toBe(false);
    expect(serviceUpdateSchema.safeParse({ ...valid, id: "s1" }).success).toBe(
      true,
    );
  });
});

describe("ngapImportSchema", () => {
  it("deduplicates codes", () => {
    expect(
      ngapImportSchema.parse({ codes: ["D700", "D700", "C"] }).codes,
    ).toEqual(["D700", "C"]);
  });

  it("takes 1 to 200 codes", () => {
    expect(ngapImportSchema.safeParse({ codes: [] }).success).toBe(false);
    expect(
      ngapImportSchema.safeParse({
        codes: Array.from({ length: 201 }, (_, i) => `X${i}`),
      }).success,
    ).toBe(false);
  });
});

describe("service category", () => {
  it("mirrors the service_category pgEnum", () => {
    expect([...SERVICE_CATEGORY_VALUES].sort()).toEqual(
      [...serviceCategory.enumValues].sort(),
    );
  });

  it("has a French label for every value", () => {
    expect(Object.keys(SERVICE_CATEGORY_LABELS).sort()).toEqual(
      [...SERVICE_CATEGORY_VALUES].sort(),
    );
  });
});

describe("money", () => {
  it("formats zero", () => {
    expect(formatDH(0)).toBe("0,00 DH");
  });
});

describe("importResultMessage", () => {
  it("reports both counts", () => {
    expect(importResultMessage({ created: 12, skipped: 0 })).toBe(
      "12 actes importés.",
    );
    expect(importResultMessage({ created: 1, skipped: 2 })).toBe(
      "1 acte importé, 2 déjà au catalogue.",
    );
    expect(importResultMessage({ created: 0, skipped: 3 })).toBe(
      "Aucun acte importé, 3 déjà au catalogue.",
    );
  });
});
