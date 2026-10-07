import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { z } from "zod";

const repositoryRoot = process.cwd();
const publishDirectory = mkdtempSync(join(tmpdir(), "style-guide-publish-"));
const manifestSchema = z.object({ files: z.array(z.string()) });
const versionLine = /"version": "[^"]+"/;

after(() => rmSync(publishDirectory, { recursive: true, force: true }));

// `npm pack` copies package.json as it is, but `npm publish` sends the registry a manifest it has corrected and
// drops an entry it rejects. A package can therefore pack with its `bin` and publish without it.
test("npm publish sends the registry the manifest as written, with nothing corrected", () => {
  const manifestText = readFileSync(
    join(repositoryRoot, "package.json"),
    "utf8",
  );
  assert.match(manifestText, versionLine);
  const manifest = manifestSchema.parse(JSON.parse(manifestText));
  for (const entry of manifest.files) {
    cpSync(join(repositoryRoot, entry), join(publishDirectory, entry), {
      recursive: true,
    });
  }
  // A version and a tag no release uses, so the dry run does not depend on what the registry already holds.
  writeFileSync(
    join(publishDirectory, "package.json"),
    manifestText.replace(versionLine, '"version": "0.0.0-manifest-check"'),
  );

  const publish = spawnSync(
    "npm",
    ["publish", "--dry-run", "--tag", "manifest-check"],
    { cwd: publishDirectory, encoding: "utf8" },
  );

  assert.equal(publish.status, 0, publish.stderr);
  assert.doesNotMatch(publish.stderr, /auto-corrected/);
});
