import { commitProblem } from "../lib/branch-flow.mjs";
import { currentBranch } from "./git.mjs";
import { loadBranchFlow } from "./repository-files.mjs";

/** @returns {number} the exit status of the pre-commit check */
export function runCheckCommit() {
  const problem = commitProblem(currentBranch(), loadBranchFlow(process.cwd()));
  if (problem === null) return 0;
  console.error(`style-guide check-commit: ${problem}`);
  return 1;
}
