import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import * as constants from "./constants";

/**
 * prompts/33b, decision 2: the clinic never reads technical vocabulary. This
 * fails if a forbidden term appears in the slice's user-facing copy
 * (`constants.ts`, every exported value) or in a string of its UI source —
 * except «Diagnostic technique (pour le support)»: `DIAGNOSTIC_COPY` and
 * `ui/diagnostic-panel.tsx`, the one place built for the support.
 */

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "env variable", pattern: /TWILIO_[A-Z_]+|CRON_SECRET|NEXT_PUBLIC_APP_URL/ },
  { name: "SID", pattern: /\bSID\b/i },
  { name: "ContentSid", pattern: /ContentSid/i },
  { name: "token", pattern: /\btoken\b/i },
  { name: "webhook", pattern: /webhook/i },
  { name: "cron", pattern: /\bcron\b/i },
  { name: "tâche planifiée", pattern: /tâches? planifiées?/i },
  // The API's name, capitalised — the French adjective «content» stays allowed.
  { name: "Content", pattern: /\bContent\b/ },
  { name: "Twilio", pattern: /twilio/i },
  { name: "{{n}}", pattern: /\{\{\s*\d+\s*\}\}/ },
  { name: "{token}", pattern: /\{\s*[\p{L}_]+\s*\}/u },
];

const EXEMPT_EXPORTS = new Set(["DIAGNOSTIC_COPY"]);
const EXEMPT_FILES = new Set(["diagnostic-panel.tsx"]);

/** Every string an exported value can produce — functions called with samples. */
const strings = (value: unknown, seen = new Set<unknown>()): string[] => {
  if (typeof value === "string") return [value];
  if (typeof value === "function") {
    try {
      return strings((value as (...args: unknown[]) => unknown)("1", "2", "3", "4"), seen);
    } catch {
      return [];
    }
  }
  if (!value || typeof value !== "object" || value instanceof RegExp || seen.has(value)) {
    return [];
  }
  seen.add(value);
  return Object.values(value).flatMap((entry) => strings(entry, seen));
};

const violations = (texts: string[]) =>
  texts.flatMap((text) =>
    FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(({ name }) => `${name}: «${text}»`),
  );

const UI_ROOT = join(__dirname, "ui");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".tsx") ? [path] : [];
  });

/** String literals and JSX text of a source file, comments and imports removed. */
const sourceStrings = (source: string) => {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/[^\n]*/g, "$1")
    .replace(/^import[\s\S]*?;$/gm, "");
  const literals = [...code.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)].map(
    // A template literal's `${…}` is code, not copy.
    (match) => match[1] ?? match[2] ?? (match[3] ?? "").replace(/\$\{[^}]*\}/g, ""),
  );
  const jsxText = [...code.matchAll(/>([^<>{}]+)</g)].map((match) => match[1].trim());
  return [...literals, ...jsxText].filter(Boolean);
};

describe("clinic-facing copy has no technical vocabulary", () => {
  it("constants.ts — every exported value but DIAGNOSTIC_COPY", () => {
    const texts = Object.entries(constants)
      .filter(([name]) => !EXEMPT_EXPORTS.has(name))
      .flatMap(([, value]) => strings(value));
    expect(texts.length).toBeGreaterThan(100);
    expect(violations(texts)).toEqual([]);
  });

  it("ui/**/*.tsx — every string and JSX text but the diagnostic panel", () => {
    const files = walk(UI_ROOT).filter((path) => !EXEMPT_FILES.has(path.split(/[\\/]/).at(-1)!));
    expect(files.length).toBeGreaterThan(10);
    const found = files.flatMap((path) =>
      violations(sourceStrings(readFileSync(path, "utf8"))).map(
        (violation) => `${relative(UI_ROOT, path)} — ${violation}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("the guard really catches them: the exempted diagnostic copy trips it", () => {
    expect(violations(strings(constants.DIAGNOSTIC_COPY)).length).toBeGreaterThan(3);
    expect(violations(["Bonjour {prenom}", "le {{2}}", "Secret CRON_SECRET"]).length).toBe(3);
  });
});
