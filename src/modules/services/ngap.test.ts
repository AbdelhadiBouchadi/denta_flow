import { describe, expect, it } from "vitest";
import { z } from "zod";

import dataset from "./data/ngap-acts.json";
import {
  getLetterValueCents,
  getNgapAct,
  NGAP_ACTS,
  NGAP_CHAPTERS,
  NGAP_LETTER_VALUES,
  planNgapImport,
  searchNgapActs,
  serviceLabelKey,
} from "./ngap";
import {
  NgapXrayRequirement,
  SERVICE_CATEGORY_VALUES,
} from "./types";

/**
 * The whole file, validated once here rather than at runtime. ngap.ts narrows
 * the JSON's types on the strength of this test.
 */
const actSchema = z
  .object({
    code: z.string().min(1),
    designation: z.string().min(1),
    nomenclatureCategory: z.string().min(1),
    suggestedCategory: z.enum(SERVICE_CATEGORY_VALUES),
    letter: z.enum(["C", "V", "D", "Z"]),
    coefficient: z.number().int().min(0),
    letterValueCents: z.number().int().positive(),
    referenceTariffCents: z.number().int().min(0),
    remarks: z.string().nullable(),
    xrayRequired: z.enum(NgapXrayRequirement).nullable(),
    onQuote: z.boolean().optional(),
  })
  .strict();

const letterValueSchema = z.object({
  cents: z.number().int().positive(),
  chapters: z.array(z.string()).min(1),
});

const datasetSchema = z.object({
  meta: z.object({
    letterValues: z.record(
      z.string(),
      z.union([letterValueSchema, z.array(letterValueSchema)]),
    ),
  }),
  acts: z.array(actSchema),
});

/** Round half up to whole dirhams, the way the source publishes tariffs. */
const roundHalfUpToDirhams = (cents: number) => Math.floor(cents / 100 + 0.5);

describe("NGAP dataset integrity", () => {
  it("matches the expected shape", () => {
    expect(() => datasetSchema.parse(dataset)).not.toThrow();
  });

  it("holds 154 acts with unique codes", () => {
    expect(NGAP_ACTS).toHaveLength(154);
    expect(new Set(NGAP_ACTS.map((act) => act.code)).size).toBe(154);
  });

  it("maps every act to a valid serviceCategory", () => {
    for (const act of NGAP_ACTS) {
      expect(SERVICE_CATEGORY_VALUES).toContain(act.suggestedCategory);
    }
  });

  it("has 7 chapters", () => {
    expect(NGAP_CHAPTERS).toHaveLength(7);
  });

  it("prices every act with the letter value of its chapter", () => {
    for (const act of NGAP_ACTS) {
      expect(getLetterValueCents(act.letter, act.nomenclatureCategory)).toBe(
        act.letterValueCents,
      );
    }
    expect(NGAP_LETTER_VALUES.length).toBeGreaterThanOrEqual(4);
  });

  it("recomputes every reference tariff: round-half-up(coefficient × letter value) × 100", () => {
    for (const act of NGAP_ACTS) {
      const expected =
        roundHalfUpToDirhams(act.coefficient * act.letterValueCents) * 100;
      expect({ code: act.code, tariff: act.referenceTariffCents }).toEqual({
        code: act.code,
        tariff: expected,
      });
    }
  });

  it("marks exactly the coefficient-0 acts as on quote", () => {
    for (const act of NGAP_ACTS) {
      expect(act.onQuote === true).toBe(act.coefficient === 0);
    }
  });
});

describe("getNgapAct", () => {
  it("finds an act by exact code", () => {
    expect(getNgapAct("D706")?.coefficient).toBe(25);
    expect(getNgapAct("D9999")).toBeNull();
    expect(getNgapAct(null)).toBeNull();
    expect(getNgapAct("")).toBeNull();
  });
});

describe("searchNgapActs", () => {
  it("finds D706 by code, case-insensitively, first", () => {
    expect(searchNgapActs({ query: "D706" })[0]?.code).toBe("D706");
    expect(searchNgapActs({ query: "d706" })[0]?.code).toBe("D706");
  });

  it("finds «détartrage» typed without accents", () => {
    const codes = searchNgapActs({ query: "detartrage" }).map((a) => a.code);
    expect(codes).toContain("D708");
    expect(searchNgapActs({ query: "DÉTARTRAGE" }).map((a) => a.code)).toEqual(
      codes,
    );
  });

  it("requires every word to match", () => {
    const results = searchNgapActs({ query: "dent sagesse" });
    expect(results.map((a) => a.code)).toContain("D720");
    for (const act of results) {
      expect(act.designation.toLowerCase()).toContain("sagesse");
    }
  });

  it("filters by chapter and honours the limit", () => {
    const radiology = searchNgapActs({ chapter: "Radiologie" });
    expect(radiology).toHaveLength(18);
    expect(radiology.every((a) => a.nomenclatureCategory === "Radiologie")).toBe(
      true,
    );
    expect(searchNgapActs({ limit: 5 })).toHaveLength(5);
  });

  it("fits every chapter in one 50-act page", () => {
    for (const chapter of NGAP_CHAPTERS) {
      expect(searchNgapActs({ chapter }).length).toBeLessThanOrEqual(50);
    }
  });
});

describe("planNgapImport", () => {
  const empty = { codes: new Set<string>(), labelKeys: new Set<string>() };

  it("creates every new code once", () => {
    const plan = planNgapImport(["D700", "D701", "D700"], empty);
    expect(plan.toCreate.map((act) => act.code)).toEqual(["D700", "D701"]);
    expect(plan.skipped).toBe(0);
  });

  it("skips codes already in the catalogue", () => {
    const plan = planNgapImport(["D700", "D701"], {
      ...empty,
      codes: new Set(["D700"]),
    });
    expect(plan.toCreate.map((act) => act.code)).toEqual(["D701"]);
    expect(plan.skipped).toBe(1);
  });

  it("is idempotent: a second run over its own result creates nothing", () => {
    const first = planNgapImport(["C", "D708", "T151"], empty);
    const second = planNgapImport(["C", "D708", "T151"], {
      codes: new Set(first.toCreate.map((act) => act.code)),
      labelKeys: new Set(
        first.toCreate.map((act) =>
          serviceLabelKey(act.suggestedCategory, act.designation),
        ),
      ),
    });
    expect(second.toCreate).toHaveLength(0);
    expect(second.skipped).toBe(3);
  });

  it("skips an act whose wording already names a service of its category", () => {
    const act = getNgapAct("D708")!;
    const plan = planNgapImport(["D708"], {
      ...empty,
      labelKeys: new Set([
        serviceLabelKey(act.suggestedCategory, act.designation.toUpperCase()),
      ]),
    });
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.skipped).toBe(1);
  });
});
