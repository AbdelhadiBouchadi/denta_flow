// scripts/check-filter-parity.ts   —   npm run check:filters
//
// Every slice that filters keeps its URL state in two places: `params.ts`
// (server, feeds the SSR prefetch through `createLoader`) and
// `hooks/use-<domain>-filters.ts` (client, feeds `useQueryStates`). They are
// two halves of one query key. The day they drift, the server prefetches one
// cache entry and the client subscribes to another: the page renders, the
// spinner clears, and the data is silently the wrong page or the wrong filter.
// Nothing throws, so nothing catches it but this check.
//
// It compares the parser maps from source rather than by calling the hook: a
// hook cannot run outside React, and a `params.ts` import would only ever
// prove the server half of the pair. Reading both files' ASTs compares the
// halves on equal terms — parser, default and options.
//
// Exits 1 on any mismatch. With zero slices it exits 0 and says so.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MODULES_DIR = join(ROOT, "src", "modules");

/** A parser entry flattened to something comparable: `parseAsInteger.withDefault(DEFAULT_PAGE)`. */
interface ParserDescriptor {
  /** The leftmost expression — `parseAsString`, `parseAsStringLiteral([...])`. */
  base: string;
  /** Each chained call by name, so `.withDefault().withOptions()` and the reverse compare equal. */
  chain: Record<string, string>;
}

type ParserMap = Record<string, ParserDescriptor>;

interface FilterDefinition {
  parsers: ParserMap;
  /** The second argument of `createLoader` / `useQueryStates`, when present. */
  options: string | null;
}

const printer = ts.createPrinter({ removeComments: true });

const parseFile = (path: string) =>
  ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

/** Canonical text for a node: formatting and comments are not differences. */
const textOf = (node: ts.Node, source: ts.SourceFile) =>
  printer
    .printNode(ts.EmitHint.Unspecified, node, source)
    .replace(/\s+/g, " ")
    .trim();

/**
 * Object literals compare by content, not by the order their keys were typed:
 * `{ clearOnDefault: true, history: "push" }` is the same options object as
 * `{ history: "push", clearOnDefault: true }`.
 */
const textOfObject = (node: ts.Node, source: ts.SourceFile): string => {
  if (!ts.isObjectLiteralExpression(node)) return textOf(node, source);

  const entries = node.properties.map((property) => {
    if (ts.isPropertyAssignment(property)) {
      return `${property.name.getText(source)}: ${textOfObject(property.initializer, source)}`;
    }
    return textOf(property, source);
  });

  return `{ ${entries.sort().join(", ")} }`;
};

const findNode = <T extends ts.Node>(
  source: ts.SourceFile,
  predicate: (node: ts.Node) => node is T,
): T | null => {
  let found: T | null = null;

  const visit = (node: ts.Node) => {
    if (found) return;
    if (predicate(node)) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
};

/** `const x = { ... }` anywhere in the file, so a named parser map resolves. */
const resolveObjectLiteral = (
  expression: ts.Expression,
  source: ts.SourceFile,
): ts.ObjectLiteralExpression | null => {
  if (ts.isObjectLiteralExpression(expression)) return expression;
  if (!ts.isIdentifier(expression)) return null;

  const name = expression.text;
  const declaration = findNode(
    source,
    (node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer !== undefined &&
      ts.isObjectLiteralExpression(node.initializer),
  );

  return (declaration?.initializer as ts.ObjectLiteralExpression) ?? null;
};

/** Flattens `parseAsInteger.withDefault(1).withOptions({...})` into a descriptor. */
const describeParser = (
  expression: ts.Expression,
  source: ts.SourceFile,
): ParserDescriptor => {
  const chain: Record<string, string> = {};
  let current: ts.Expression = expression;

  while (
    ts.isCallExpression(current) &&
    ts.isPropertyAccessExpression(current.expression)
  ) {
    const method = current.expression.name.text;
    chain[method] = current.arguments
      .map((argument) => textOfObject(argument, source))
      .join(", ");
    current = current.expression.expression;
  }

  return { base: textOf(current, source), chain };
};

const describeParserMap = (
  literal: ts.ObjectLiteralExpression,
  source: ts.SourceFile,
): ParserMap => {
  const parsers: ParserMap = {};

  for (const property of literal.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    parsers[property.name.getText(source)] = describeParser(
      property.initializer,
      source,
    );
  }

  return parsers;
};

/** Finds `createLoader(...)` or `useQueryStates(...)` and describes its parser map. */
const readFilterDefinition = (
  path: string,
  calleeNames: string[],
): FilterDefinition | string => {
  const source = parseFile(path);
  const call = findNode(
    source,
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      calleeNames.includes(node.expression.text),
  );

  if (!call) {
    return `no ${calleeNames.map((name) => `${name}()`).join(" or ")} call found`;
  }

  const [parserArgument, optionsArgument] = call.arguments;
  if (!parserArgument) return "the parser map argument is missing";

  const literal = resolveObjectLiteral(parserArgument, source);
  if (!literal) {
    return `the parser map is not an object literal in this file (${textOf(parserArgument, source)})`;
  }

  return {
    parsers: describeParserMap(literal, source),
    options: optionsArgument ? textOfObject(optionsArgument, source) : null,
  };
};

const listDirectories = (path: string) =>
  existsSync(path)
    ? readdirSync(path).filter((entry) =>
        statSync(join(path, entry)).isDirectory(),
      )
    : [];

const findFiltersHooks = (domainDir: string) => {
  const hooksDir = join(domainDir, "hooks");
  if (!existsSync(hooksDir)) return [];

  return readdirSync(hooksDir)
    .filter((entry) => /^use-.+-filters\.ts$/.test(entry))
    .map((entry) => join(hooksDir, entry));
};

const problems: string[] = [];
const report = (domain: string, message: string) =>
  problems.push(`  ${domain}: ${message}`);

const comparePair = (domain: string, paramsPath: string, hookPath: string) => {
  const problemsBefore = problems.length;
  const server = readFilterDefinition(paramsPath, ["createLoader"]);
  const client = readFilterDefinition(hookPath, ["useQueryStates"]);

  if (typeof server === "string") {
    report(domain, `${relative(ROOT, paramsPath)} — ${server}`);
    return;
  }
  if (typeof client === "string") {
    report(domain, `${relative(ROOT, hookPath)} — ${client}`);
    return;
  }

  const serverKeys = Object.keys(server.parsers).sort();
  const clientKeys = Object.keys(client.parsers).sort();

  const missingInHook = serverKeys.filter((key) => !clientKeys.includes(key));
  const missingInParams = clientKeys.filter((key) => !serverKeys.includes(key));

  for (const key of missingInHook) {
    report(domain, `"${key}" is in params.ts but not in the filters hook`);
  }
  for (const key of missingInParams) {
    report(domain, `"${key}" is in the filters hook but not in params.ts`);
  }

  for (const key of serverKeys.filter((key) => clientKeys.includes(key))) {
    const serverParser = server.parsers[key];
    const clientParser = client.parsers[key];

    if (serverParser.base !== clientParser.base) {
      report(
        domain,
        `"${key}" uses a different parser — params.ts \`${serverParser.base}\`, hook \`${clientParser.base}\``,
      );
    }

    const methods = [
      ...new Set([
        ...Object.keys(serverParser.chain),
        ...Object.keys(clientParser.chain),
      ]),
    ].sort();

    for (const method of methods) {
      const serverArguments = serverParser.chain[method];
      const clientArguments = clientParser.chain[method];

      if (serverArguments === clientArguments) continue;

      const describe = (value: string | undefined) =>
        value === undefined ? "absent" : `\`.${method}(${value})\``;

      report(
        domain,
        `"${key}" differs on .${method}() — params.ts ${describe(serverArguments)}, hook ${describe(clientArguments)}`,
      );
    }
  }

  if (server.options !== client.options) {
    report(
      domain,
      `the options argument differs — params.ts \`${server.options ?? "absent"}\`, hook \`${client.options ?? "absent"}\``,
    );
  }

  if (problems.length === problemsBefore) {
    console.log(
      `  ✓ ${domain} — ${serverKeys.length} parser${serverKeys.length === 1 ? "" : "s"} in parity`,
    );
  }
};

const main = () => {
  const domains = listDirectories(MODULES_DIR);
  let pairs = 0;

  console.log("Checking params.ts ↔ filters hook parity…\n");

  for (const domain of domains) {
    const domainDir = join(MODULES_DIR, domain);
    const paramsPath = join(domainDir, "params.ts");
    const hookPaths = findFiltersHooks(domainDir);
    const hasParams = existsSync(paramsPath);

    if (!hasParams && hookPaths.length === 0) continue;

    if (!hasParams) {
      report(
        domain,
        `${relative(ROOT, hookPaths[0])} has no params.ts beside it — the server cannot prefetch what the client filters`,
      );
      continue;
    }

    if (hookPaths.length === 0) {
      report(
        domain,
        "params.ts has no hooks/use-<domain>-filters.ts mirroring it",
      );
      continue;
    }

    if (hookPaths.length > 1) {
      report(
        domain,
        `several filters hooks mirror one params.ts: ${hookPaths.map((path) => relative(ROOT, path)).join(", ")}`,
      );
      continue;
    }

    pairs++;
    comparePair(domain, paramsPath, hookPaths[0]);
  }

  if (problems.length) {
    console.error("\nFilter parity broken:\n");
    console.error(problems.join("\n"));
    console.error(
      "\nparams.ts and its filters hook must declare the same keys, the same parsers and the same defaults.",
    );
    process.exit(1);
  }

  console.log(
    pairs === 0
      ? "  No slice declares URL filters yet — nothing to compare."
      : `\n${pairs} slice${pairs === 1 ? "" : "s"} in parity.`,
  );
};

main();
