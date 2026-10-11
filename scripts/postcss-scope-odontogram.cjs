/**
 * Scopes the stylesheet of `react-advanced-odontogram` to the chart.
 *
 * The library ships one global stylesheet. Imported as-is it would restyle
 * the whole app: it declares `--card`, `--muted`, `--line` and `--accent` on
 * `:root` (our shadcn tokens carry the same names), sets `html, body
 * { height: 100% }`, styles every native `select`, and ships
 * `.hidden { display: none !important }`, which beats every responsive
 * `hidden md:flex` in the app — no cascade layer can undo an `!important`.
 *
 * The file is consumed unmodified from node_modules (never patched, never
 * forked); this transform only rewrites its selectors at build time, and only
 * for that one file:
 *
 * - `:root` → `.odontogram-root`, `.dark` → `.dark .odontogram-root`: the
 *   library's own variables live on the chart's root element only;
 * - `html`, `body`, `.dark body`: dropped — the page belongs to the app;
 * - selectors already naming `.odontogram-root`: kept;
 * - selectors on `.odon-*` classes: kept global. Those are the popovers the
 *   engine appends to `document.body` (touch zoom, context menu, caries depth
 *   picker), outside the chart's root, and the prefix already namespaces them;
 * - everything else gets the `.odontogram-root ` prefix (after `.dark `).
 *
 * Keyframes are left alone. CommonJS because Turbopack `require()`s each
 * plugin of postcss.config.mjs by path. Covered by
 * src/modules/odontogram/scope-css.test.ts.
 */

const ROOT = ".odontogram-root";
const DARK = ".dark";
const TARGET = /react-advanced-odontogram[\\/]dist[\\/]style\.css$/;

/** One selector of a list → its scoped form, or null to drop it. */
const scopeSelector = (selector) => {
  const sel = selector.trim();

  if (sel === "html" || sel === "body" || sel === `${DARK} body`) return null;
  if (sel === ":root") return ROOT;
  if (sel === DARK) return `${DARK} ${ROOT}`;

  const isDark = sel.startsWith(`${DARK} `);
  const rest = isDark ? sel.slice(DARK.length + 1).trimStart() : sel;

  if (rest.includes(ROOT)) return sel;
  if (rest.startsWith(".odon-")) return sel;

  return `${isDark ? `${DARK} ` : ""}${ROOT} ${rest}`;
};

const insideKeyframes = (rule) => {
  for (let node = rule.parent; node; node = node.parent) {
    if (node.type === "atrule" && /keyframes$/i.test(node.name)) return true;
  }
  return false;
};

/** @type {import("postcss").PluginCreator<{ test?: RegExp }>} */
const scopeOdontogram = (options = {}) => {
  const test = options.test ?? TARGET;

  return {
    postcssPlugin: "postcss-scope-odontogram",
    Once(root, { result }) {
      const from = (result.opts.from ?? "").replaceAll("\\", "/");
      if (!test.test(from)) return;

      root.walkRules((rule) => {
        if (insideKeyframes(rule)) return;
        const selectors = rule.selectors
          .map(scopeSelector)
          .filter((selector) => selector !== null);
        if (selectors.length === 0) rule.remove();
        else rule.selectors = [...new Set(selectors)];
      });
    },
  };
};
scopeOdontogram.postcss = true;

module.exports = scopeOdontogram;
module.exports.scopeSelector = scopeSelector;
