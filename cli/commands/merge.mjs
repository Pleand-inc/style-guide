// Merges a pull request the way the branch flow requires:
//   <prefix>/<slug> -> develop : squash, delete the head branch
//   develop -> master          : merge commit titled "<PR title> (#<number>)", keep develop
// A pull request in a GitHub stack refuses `gh pr merge`, so it merges through `gh stack merge`, and this command
// then deletes the head branch, which the stack merge leaves behind. `gh stack merge <n>` also merges every unmerged
// pull request below #<n>; only the lowest of them targets develop, so the flow lets only that one through.

import { execFileSync, spawnSync } from "node:child_process";

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
// When GitHub answers with an HTTP error, `gh api` prints the body on stdout and, on stderr, `gh: ` followed by
// `<message> (HTTP <status>)` when the body has a `message`, unless its `errors` field is a non-empty string, which
// gives `<errors> (<message>)`; by the `errors` texts, without the status, when there is no `message`; and by
// `HTTP <status>` when it finds neither. A scope or SSO hint may follow on the next lines, and gh exits 1
// (gh 2.102.0: processResponse and parseErrorResponse in pkg/cmd/api/api.go, SilentError in internal/ghcmd/cmd.go).
// The gh CLI's comment in deleteRemoteBranch (pkg/cmd/pr/merge/merge.go) says GitHub answers the DELETE of a branch
// that is already gone with 422 and the message "Reference does not exist", and rarely with 404 and the same message.
// GitHub's REST docs for "Delete a reference" also give 422 for a failed validation, a delete of the default branch
// and a spammed endpoint. `gh pr merge --delete-branch` still takes any 422 or 404 as the branch deleted, by status
// alone; its TODO says it might check the message against "Reference does not exist" for more accuracy. This command
// checks it: only this line counts as the branch deleted, and every other failure, a bare `gh: HTTP 404` included,
// fails.
const ALREADY_DELETED = /^gh: Reference does not exist \(HTTP (422|404)\)$/m;

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
function showGhCall(ghArguments) {
  const shown = ghArguments.map((argument) =>
    /\s/.test(argument) ? JSON.stringify(argument) : argument,
  );
  console.log(`gh ${shown.join(" ")}`);
}

/** @param {string[]} ghArguments */
function runGh(ghArguments) {
  showGhCall(ghArguments);
  execFileSync("gh", ghArguments, { stdio: "inherit" });
}

/**
 * Deletes the head branch that `gh stack merge` leaves behind. When GitHub answers that the branch does not exist,
 * whoever deleted it, the branch counts as deleted; any other failure passes on what gh printed and fails.
 * @param {string[]} ghArguments the `gh api -X DELETE` call
 * @param {string} head the branch it deletes
 */
function deleteHeadBranch(ghArguments, head) {
  showGhCall(ghArguments);
  const { error, status, stdout, stderr } = spawnSync("gh", ghArguments, {
    stdio: ["inherit", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (error) throw error;
  const gone = status === 0 ? null : ALREADY_DELETED.exec(stderr);
  if (gone !== null) {
    console.log(`${head} was already deleted: GitHub answered HTTP ${gone[1]}`);
    return;
  }
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  // The message runGh's execFileSync gives a failed call, so a failed delete reads as it did before.
  if (status !== 0)
    throw new Error(`Command failed: gh ${ghArguments.join(" ")}`);
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
 * @param {string[][]} commands the merge, then, for a pull request in a stack, the deletion of the head branch it
 *   leaves behind (planMerge returns no other command)
 * @param {{ number: string, repo: string, head: string }} pullRequest
 * @returns {number} the exit status
 */
function carryOut([merge = [], deleteHead], { number, repo, head }) {
  runGh(merge);
  if (deleteHead === undefined) return 0;
  // `gh stack merge` goes through GitHub's asynchronous merge API, and with a merge queue it only enqueues:
  // the head branch is deleted only once the pull request reads as merged.
  const { state } = viewPullRequest(number, repo);
  if (state !== "MERGED")
    return refuse(
      `#${number} is ${state} after the merge, not MERGED: delete ${head} once it merges`,
    );
  deleteHeadBranch(deleteHead, head);
  return 0;
}
