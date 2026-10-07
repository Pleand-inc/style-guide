import { readFileSync } from "node:fs";

import { pushProblems } from "../lib/branch-flow.mjs";
import { loadBranchFlow } from "./repository-files.mjs";

const STDIN = 0;

/** @returns {number} the exit status of the pre-push check; git writes the pushed refs to stdin */
export function runCheckPush() {
  const problems = pushProblems(
    readFileSync(STDIN, "utf8"),
    loadBranchFlow(process.cwd()),
  );
  for (const problem of problems)
    console.error(`style-guide check-push: ${problem}`);
  return problems.length === 0 ? 0 : 1;
}
