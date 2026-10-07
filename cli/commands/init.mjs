import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { initPlan, inspectSetup } from "../lib/setup.mjs";
import {
  listPackageRuleFiles,
  loadBranchFlow,
  readRepositoryFiles,
  requireRepositoryRoot,
} from "./repository-files.mjs";

/** @returns {number} 0 when nothing is left to do by hand, 1 otherwise */
export function runInit() {
  const directory = process.cwd();
  requireRepositoryRoot(directory, "init");
  // Read for its validation only: a configuration the hooks cannot use is reported before anything is written.
  loadBranchFlow(directory);
  const plan = initPlan(
    inspectSetup(readRepositoryFiles(directory), listPackageRuleFiles()),
  );
  for (const { path, content } of plan.writes) {
    const target = join(directory, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  for (const line of plan.lines) console.log(line);
  return plan.exitCode;
}
