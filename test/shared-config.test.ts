import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { z } from "zod";

const repositoryRoot = process.cwd();
const fixturesDirectory = join(repositoryRoot, "test", "fixtures");
const biomeBinary = join(repositoryRoot, "node_modules", ".bin", "biome");
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

const expectedByBiomeFixture = new Map([
  ["block-depth.ts", { label: blockDepthLabel, count: 1 }],
  [
    "cognitive-complexity.ts",
    { label: "lint/complexity/noExcessiveCognitiveComplexity", count: 1 },
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
  ["relative-import.ts", { label: "lint/style/noRestrictedImports", count: 7 }],
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
