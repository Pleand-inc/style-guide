import { pullRequestPairProblem } from "../lib/branch-flow.mjs";
import { UsageError } from "../lib/errors.mjs";
import { loadBranchFlow } from "./repository-files.mjs";

/** @returns {number} the exit status of the pull request pairing check */
export function runCheckPullRequest() {
  // GitHub sets GITHUB_BASE_REF and GITHUB_HEAD_REF to "" outside pull request events, so "" counts as unset.
  const base = process.env.BASE_REF || process.env.GITHUB_BASE_REF || "";
  const head = process.env.HEAD_REF || process.env.GITHUB_HEAD_REF || "";
  if (base === "" || head === "") {
    throw new UsageError(
      "check-pull-request needs the pull request's base and head branch in BASE_REF and HEAD_REF " +
        "(or GITHUB_BASE_REF and GITHUB_HEAD_REF)",
    );
  }
  const problem = pullRequestPairProblem(
    { base, head },
    loadBranchFlow(process.cwd()),
  );
  if (problem !== null) {
    console.error(`style-guide check-pull-request: ${problem}`);
    return 1;
  }
  console.log(
    `style-guide check-pull-request: ${head} -> ${base} follows the flow`,
  );
  return 0;
}
