import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

import { ODONTOGRAM_LIBRARY_VERSION } from "./constants";

// CommonJS, as Turbopack loads it (postcss.config.mjs).
const require = createRequire(import.meta.url);
const scopeOdontogram = require("../../../scripts/postcss-scope-odontogram.cjs");
const { scopeSelector } = scopeOdontogram as {
  scopeSelector: (selector: string) => string | null;
};

const LIBRARY_DIR = join(
  process.cwd(),
  "node_modules",
  "react-advanced-odontogram",
);
const STYLESHEET = join(LIBRARY_DIR, "dist", "style.css");

describe("scopeSelector", () => {
  it.each([
    [":root", ".odontogram-root"],
    [".dark", ".dark .odontogram-root"],
    ["*", ".odontogram-root *"],
    ["select", ".odontogram-root select"],
    [".hidden", ".odontogram-root .hidden"],
    [".tooth-tile.active", ".odontogram-root .tooth-tile.active"],
    [".dark .btn:hover", ".dark .odontogram-root .btn:hover"],
    ["#crownReplaceRow", ".odontogram-root #crownReplaceRow"],
    // Already scoped by the library itself.
    [".dark .odontogram-root", ".dark .odontogram-root"],
    // Popovers appended to <body>: namespaced, left global.
    [".odon-zoom-popover", ".odon-zoom-popover"],
    [".dark .odon-ctx-menu", ".dark .odon-ctx-menu"],
  ])("%s → %s", (input, output) => {
    expect(scopeSelector(input)).toBe(output);
  });

  it.each(["html", "body", ".dark body"])("drops %s", (input) => {
    expect(scopeSelector(input)).toBeNull();
  });
});

describe("the library's stylesheet, scoped", () => {
  const run = (from: string) =>
    postcss([scopeOdontogram()]).process(readFileSync(STYLESHEET, "utf8"), {
      from,
    }).css;

  const scoped = run(STYLESHEET);
  const selectors: string[] = [];
  postcss.parse(scoped).walkRules((rule) => {
    const parent = rule.parent;
    if (
      parent?.type === "atrule" &&
      /keyframes$/.test((parent as postcss.AtRule).name)
    ) {
      return;
    }
    selectors.push(...rule.selectors);
  });

  it("leaves no rule that can reach the app outside the chart", () => {
    const leaking = selectors.filter(
      (selector) =>
        !selector.includes(".odontogram-root") &&
        !/^(\.dark )?\.odon-/.test(selector),
    );
    expect(leaking).toEqual([]);
  });

  it("no longer declares our token names on :root", () => {
    expect(scoped).not.toMatch(/(^|[}\s]):root\s*\{/);
    expect(scoped).not.toMatch(/(^|[}\s])html\s*[,{]/);
  });

  it("keeps the `!important` .hidden inside the chart", () => {
    expect(scoped).toContain(
      ".odontogram-root .hidden{display:none!important}",
    );
  });

  it("touches no other file", () => {
    const untouched = run("/app/src/app/globals.css");
    expect(untouched).toBe(readFileSync(STYLESHEET, "utf8"));
  });
});

describe("the pinned library", () => {
  it("is the version every envelope records", () => {
    const installed = JSON.parse(
      readFileSync(join(LIBRARY_DIR, "package.json"), "utf8"),
    ) as { version: string };
    const app = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };

    // Exact: no caret, no tilde (prompts/28).
    expect(app.dependencies["react-advanced-odontogram"]).toBe(
      ODONTOGRAM_LIBRARY_VERSION,
    );
    expect(installed.version).toBe(ODONTOGRAM_LIBRARY_VERSION);
  });
});
