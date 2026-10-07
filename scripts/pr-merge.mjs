// Merges a pull request the way the branch flow requires:
//   <prefix>/<slug> -> develop : squash, delete the head branch
//   develop -> master          : merge commit titled "<PR title> (#<number>)", keep develop
// A pull request in a GitHub stack refuses `gh pr merge`, so it merges through `gh stack merge`, and the script then
// deletes the head branch, which the stack merge leaves behind. `gh stack merge <n>` also merges every unmerged pull
// request below #<n>; only the lowest of them targets develop, so decideMerge lets only that one through.
// `gh stack` has no --repo flag, so a stacked pull request is merged only from inside a checkout of this repository.
// Usage: node scripts/pr-merge.mjs <pr-number>
import { execFileSync } from "node:child_process";

import { decideMerge, mergeCommands } from "./branch-flow.mjs";

// Pinned, so the script acts on this repository whatever remote the checkout's gh default points at.
const REPO = "Pleand-inc/style-guide";

function refuse(message) {
  console.error(`pr-merge: ${message}`);
  process.exit(1);
}

// True when the current directory is a checkout whose origin is REPO.
function isCheckoutOfRepo() {
  let origin;
  try {
    origin = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return false;
  }
  const path = origin.trim().replace(/(\.git)?\/?$/, "").toLowerCase();
  const repo = REPO.toLowerCase();
  return path.endsWith(`/${repo}`) || path.endsWith(`:${repo}`);
}

function run(ghArgs) {
  console.log(`gh ${ghArgs.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(" ")}`);
  execFileSync("gh", ghArgs, { stdio: "inherit" });
}

const args = process.argv.slice(2);
const number = args[0] ?? "";
if (args.length !== 1 || !/^[1-9]\d*$/.test(number)) {
  refuse("usage: node scripts/pr-merge.mjs <pr-number> (no other arguments)");
}

const viewPr = (fields) =>
  JSON.parse(execFileSync("gh", ["pr", "view", number, "--repo", REPO, "--json", fields], { encoding: "utf8" }));

const pr = viewPr("baseRefName,headRefName,state,isDraft,title");

if (pr.state !== "OPEN") refuse(`#${number} is ${pr.state}, not OPEN`);
if (pr.isDraft) refuse(`#${number} is a draft: mark it ready for review first`);

const decision = decideMerge({ base: pr.baseRefName, head: pr.headRefName });
if ("refused" in decision) refuse(`#${number} ${decision.refused}`);

// The REST pull request has `stack` set only when it is part of a stack.
const { stack } = JSON.parse(execFileSync("gh", ["api", `repos/${REPO}/pulls/${number}`], { encoding: "utf8" }));
const inStack = Boolean(stack);

const commands = mergeCommands({ number, repo: REPO, title: pr.title, headRef: pr.headRefName, inStack }, decision);
if ("refused" in commands) refuse(`#${number} ${commands.refused}`);
if (inStack && !isCheckoutOfRepo()) {
  refuse(`#${number} is in a stack and gh stack merge has no --repo flag: run this inside a checkout of ${REPO}`);
}

const [merge, ...cleanup] = commands;
run(merge);
// `gh stack merge` goes through GitHub's asynchronous merge API, and with a merge queue it only enqueues:
// delete the head branch only once the pull request reads as merged.
if (cleanup.length > 0) {
  const { state } = viewPr("state");
  if (state !== "MERGED") {
    refuse(`#${number} is ${state} after the merge, not MERGED: delete ${pr.headRefName} once it merges`);
  }
}
for (const ghArgs of cleanup) run(ghArgs);
