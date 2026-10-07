// Merges a pull request the way the branch flow requires:
//   <prefix>/<slug> -> develop : squash, delete the head branch
//   develop -> master          : merge commit titled "<PR title> (#<number>)", keep develop
// A pull request in a GitHub stack refuses `gh pr merge`, so it merges through `gh stack merge`, and this command
// then deletes the head branch, which the stack merge leaves behind. `gh stack merge <n>` also merges every unmerged
// pull request below #<n>; only the lowest of them targets develop, so the flow lets only that one through.

import { execFileSync } from "node:child_process";

import { planMerge } from "../lib/branch-flow.mjs";
import { UsageError } from "../lib/errors.mjs";
import {
  isStackedPullRequest,
  readPullRequestView,
} from "../lib/github-payloads.mjs";
import { isOriginOf, resolveRepositorySlug } from "../lib/repository-slug.mjs";
import { originUrl } from "./git.mjs";
import { loadBranchFlow } from "./repository-files.mjs";

const PULL_REQUEST_NUMBER = /^[1-9]\d*$/;
const VIEW_FIELDS = "baseRefName,headRefName,state,isDraft,title";

function requireGh() {
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "the gh CLI did not run: install it from https://cli.github.com and sign in with gh auth login",
    );
  }
}

/**
 * @param {string[]} ghArguments
 * @returns {unknown} the JSON `gh` printed
 */
function readFromGh(ghArguments) {
  return JSON.parse(execFileSync("gh", ghArguments, { encoding: "utf8" }));
}

/** @param {string[]} ghArguments */
function runGh(ghArguments) {
  const shown = ghArguments.map((argument) =>
    /\s/.test(argument) ? JSON.stringify(argument) : argument,
  );
  console.log(`gh ${shown.join(" ")}`);
  execFileSync("gh", ghArguments, { stdio: "inherit" });
}

/**
 * @param {string} number
 * @param {string} repo
 */
function viewPullRequest(number, repo) {
  return readPullRequestView(
    readFromGh(["pr", "view", number, "--repo", repo, "--json", VIEW_FIELDS]),
  );
}

/**
 * @param {string} message
 * @returns {number} the exit status of a refused merge
 */
function refuse(message) {
  console.error(`style-guide merge: ${message}`);
  return 1;
}

/**
 * @param {string[]} commandArguments
 * @returns {number} the exit status
 */
export function runMerge(commandArguments) {
  const number = commandArguments[0] ?? "";
  if (commandArguments.length !== 1 || !PULL_REQUEST_NUMBER.test(number)) {
    throw new UsageError(
      "merge takes one pull request number and nothing else: style-guide merge <pr-number>",
    );
  }
  const branchFlow = loadBranchFlow(process.cwd());
  const origin = originUrl();
  const repo = resolveRepositorySlug(process.env.GITHUB_REPOSITORY, origin);
  if (repo === null) {
    return refuse(
      "cannot tell which repository to act on: set GITHUB_REPOSITORY to <owner>/<repository> " +
        "or run inside a checkout whose origin is a github.com repository",
    );
  }
  requireGh();
  const view = viewPullRequest(number, repo);
  const inStack = isStackedPullRequest(
    readFromGh(["api", `repos/${repo}/pulls/${number}`]),
  );
  const commands = planMerge({ ...view, number, repo, inStack }, branchFlow);
  if ("refused" in commands) return refuse(`#${number} ${commands.refused}`);
  if (inStack && !isOriginOf(repo, origin)) {
    return refuse(
      `#${number} is in a stack and gh stack merge has no --repo flag: run this inside a checkout of ${repo}`,
    );
  }
  return carryOut(commands, { number, repo, head: view.head });
}

/**
 * @param {string[][]} commands the merge, then what cleans up after it
 * @param {{ number: string, repo: string, head: string }} pullRequest
 * @returns {number} the exit status
 */
function carryOut([merge = [], ...cleanup], { number, repo, head }) {
  runGh(merge);
  if (cleanup.length === 0) return 0;
  // `gh stack merge` goes through GitHub's asynchronous merge API, and with a merge queue it only enqueues:
  // the head branch is deleted only once the pull request reads as merged.
  const { state } = viewPullRequest(number, repo);
  if (state !== "MERGED")
    return refuse(
      `#${number} is ${state} after the merge, not MERGED: delete ${head} once it merges`,
    );
  for (const ghArguments of cleanup) runGh(ghArguments);
  return 0;
}
