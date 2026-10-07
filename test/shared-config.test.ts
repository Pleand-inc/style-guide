import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { z } from "zod";

const repositoryRoot = process.cwd();
const fixturesDirectory = join(repositoryRoot, "test", "fixtures");
const biomeBinary = join(repositoryRoot, "node_modules", ".bin", "biome");
const typescriptBinary = join(repositoryRoot, "node_modules", ".bin", "tsc");
const consumerDirectory = mkdtempSync(join(tmpdir(), "style-guide-consumer-"));

const reportSchema = z.object({
  diagnostics: z.array(
    z.object({
      category: z.string(),
      message: z.string(),
      location: z.object({ path: z.string() }),
    }),
  ),
});

type Diagnostic = z.infer<typeof reportSchema>["diagnostics"][number];

const blockDepthLabel =
  "plugin: Blocks are nested more than 4 levels deep. Move the inner blocks into a function.";
const suppressionCommentLabel =
  "plugin: This file contains a biome-ignore suppression comment. Remove the comment and fix the code the rule reports.";
const relativeImportTypeLabel =
  "plugin: This import() type takes a relative path. Import through the alias declared in tsconfig paths instead.";
const relativeDynamicImportLabel =
  "plugin: This dynamic import() builds a relative path. Import through the alias declared in tsconfig paths instead.";
const relativeViModuleCallLabel =
  "plugin: This vi.mock, vi.doMock, vi.unmock, vi.doUnmock, vi.importActual or vi.importMock call takes a relative path. Import through the alias declared in tsconfig paths instead.";
const relativeImportMetaGlobLabel =
  "plugin: This import.meta.glob() takes a relative pattern. Import through the alias declared in tsconfig paths instead.";
const dotSegmentLabel =
  "plugin: This module path has a ./ or ../ segment after the alias. Write the path from the alias without dot segments.";

const expectedByBiomeFixture = new Map([
  ["block-depth.ts", { label: blockDepthLabel, count: 1 }],
  [
    "cognitive-complexity.ts",
    { label: "lint/complexity/noExcessiveCognitiveComplexity", count: 1 },
  ],
  ["dot-segment-module-path.ts", { label: dotSegmentLabel, count: 2 }],
  [
    "dynamic-import-concatenation.ts",
    { label: relativeDynamicImportLabel, count: 1 },
  ],
  [
    "dynamic-import-template.ts",
    { label: relativeDynamicImportLabel, count: 1 },
  ],
  ["enum.ts", { label: "lint/style/noEnum", count: 1 }],
  ["explicit-any.ts", { label: "lint/suspicious/noExplicitAny", count: 1 }],
  [
    "lines-per-function.ts",
    { label: "lint/complexity/noExcessiveLinesPerFunction", count: 1 },
  ],
  ["max-params.ts", { label: "lint/complexity/useMaxParams", count: 1 }],
  ["nested-ternary.ts", { label: "lint/style/noNestedTernary", count: 1 }],
  [
    "non-null-assertion.ts",
    { label: "lint/style/noNonNullAssertion", count: 1 },
  ],
  ["relative-import.ts", { label: "lint/style/noRestrictedImports", count: 8 }],
  [
    "relative-import-meta-glob.ts",
    { label: relativeImportMetaGlobLabel, count: 3 },
  ],
  ["relative-import-type.ts", { label: relativeImportTypeLabel, count: 3 }],
  ["relative-vi-mock.ts", { label: relativeViModuleCallLabel, count: 7 }],
  [
    "suppression-block-comment.ts",
    { label: suppressionCommentLabel, count: 1 },
  ],
  ["suppression-comment.ts", { label: suppressionCommentLabel, count: 1 }],
  [
    "type-assertion.ts",
    { label: "lint/nursery/noUnsafeTypeAssertion", count: 5 },
  ],
]);

const consumerTsconfigByPreset = new Map([
  [
    "base",
    {
      extends: "@pleand-inc/style-guide/tsconfig",
      compilerOptions: {
        noEmit: true,
        module: "es2022",
        moduleResolution: "bundler",
      },
      include: ["src/typescript/base"],
    },
  ],
  [
    "web",
    {
      extends: "@pleand-inc/style-guide/tsconfig/web",
      include: ["src/typescript/web"],
    },
  ],
  [
    "node",
    {
      extends: "@pleand-inc/style-guide/tsconfig/node",
      include: ["src/typescript/node"],
    },
  ],
]);

const expectedTypescriptErrorsByPreset = new Map([
  [
    "base",
    [
      { fixture: "erasable-syntax-only.ts", code: "TS1294" },
      { fixture: "exact-optional-property-types.ts", code: "TS1360" },
      { fixture: "strict-implicit-any.ts", code: "TS7006" },
      { fixture: "strict-null-checks.ts", code: "TS18048" },
      { fixture: "unchecked-indexed-access.ts", code: "TS2532" },
      { fixture: "verbatim-module-syntax.ts", code: "TS1205" },
    ],
  ],
  ["web", [{ fixture: "node-global.ts", code: "TS2591" }]],
  ["node", [{ fixture: "dom-global.ts", code: "TS2584" }]],
]);

const typescriptErrorLine =
  /^src\/typescript\/[a-z]+\/([a-z-]+\/[a-z-]+\.ts)\(\d+,\d+\): error (TS\d+):.*$/;

const labelOf = (diagnostic: Diagnostic) => {
  if (diagnostic.category === "plugin") {
    return `plugin: ${diagnostic.message}`;
  }
  return diagnostic.category;
};

const runBiome = (command: string, target: string) => {
  const result = spawnSync(
    biomeBinary,
    [command, "--reporter=json", "--max-diagnostics=none", target],
    { cwd: consumerDirectory, encoding: "utf8" },
  );
  assert.notEqual(result.stdout, "", result.stderr);
  return reportSchema.parse(JSON.parse(result.stdout));
};

// biome/shared.json names its plugins by their path under the consumer's node_modules, so the
// configuration only loads from a directory that has the packed package installed.
execFileSync("npm", ["pack", "--pack-destination", consumerDirectory], {
  cwd: repositoryRoot,
});
const tarballName = readdirSync(consumerDirectory).find((name) =>
  name.endsWith(".tgz"),
);
assert.ok(tarballName, "npm pack wrote no tarball");
const installedPackageDirectory = join(
  consumerDirectory,
  "node_modules",
  "@pleand-inc",
  "style-guide",
);
mkdirSync(installedPackageDirectory, { recursive: true });
execFileSync("tar", [
  "-xzf",
  join(consumerDirectory, tarballName),
  "-C",
  installedPackageDirectory,
  "--strip-components=1",
]);
cpSync(fixturesDirectory, join(consumerDirectory, "src"), { recursive: true });
writeFileSync(
  join(consumerDirectory, "biome.json"),
  JSON.stringify({ extends: ["@pleand-inc/style-guide/biome"] }),
);
// tsconfig/node.json names the node types, and TypeScript looks type packages up from the
// consumer's node_modules.
symlinkSync(
  join(repositoryRoot, "node_modules", "@types"),
  join(consumerDirectory, "node_modules", "@types"),
);
for (const [preset, tsconfig] of consumerTsconfigByPreset) {
  writeFileSync(
    join(consumerDirectory, `tsconfig.${preset}.json`),
    JSON.stringify(tsconfig),
  );
}

after(() => rmSync(consumerDirectory, { recursive: true, force: true }));

test("every Biome violation fixture names the rule that reports it", () => {
  const fixtureNames = readdirSync(
    join(fixturesDirectory, "biome", "violations"),
  );
  assert.deepEqual(
    fixtureNames.sort(),
    [...expectedByBiomeFixture.keys()].sort(),
  );
});

for (const [fixtureName, expected] of expectedByBiomeFixture) {
  test(`Biome reports ${fixtureName} ${expected.count} time(s), by its own rule only`, () => {
    const report = runBiome(
      "lint",
      join("src", "biome", "violations", fixtureName),
    );
    assert.deepEqual(
      report.diagnostics.map(labelOf),
      Array.from({ length: expected.count }, () => expected.label),
    );
  });
}

test("Biome passes the conforming fixtures on lint, format and import sorting", () => {
  const report = runBiome("check", join("src", "biome", "conforming"));
  assert.deepEqual(report.diagnostics, []);
});

for (const [preset, expected] of expectedTypescriptErrorsByPreset) {
  test(`every TypeScript violation fixture of the ${preset} preset names its error`, () => {
    const fixtureNames = readdirSync(
      join(fixturesDirectory, "typescript", preset, "violations"),
    );
    assert.deepEqual(
      fixtureNames.sort(),
      expected.map(({ fixture }) => fixture).sort(),
    );
  });

  test(`TypeScript with the ${preset} preset reports each violation fixture by its own error and nothing else`, () => {
    const result = spawnSync(
      typescriptBinary,
      ["--project", `tsconfig.${preset}.json`, "--pretty", "false"],
      { cwd: consumerDirectory, encoding: "utf8" },
    );
    const reported = result.stdout
      .split("\n")
      .filter((line) => typescriptErrorLine.test(line))
      .map((line) => line.replace(typescriptErrorLine, "$1 $2"));
    assert.deepEqual(
      reported.sort(),
      expected
        .map(({ fixture, code }) => `violations/${fixture} ${code}`)
        .sort(),
    );
  });
}
