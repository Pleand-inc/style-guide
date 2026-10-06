// Merges a pull request the way the branch flow requires:
//   <prefix>/<slug> -> develop : squash, delete the head branch
//   develop -> master          : merge commit titled "<PR title> (#<number>)", keep develop
// Usage: node scripts/pr-merge.mjs <pr-number>
import { execFileSync } from "node:child_process";

import { decideMerge } from "./branch-flow.mjs";

// Pinned, so the script acts on this repository whatever remote the checkout's gh default points at.
const REPO = "Pleand-inc/style-guide";

function refuse(message) {
  console.error(`pr-merge: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const number = args[0] ?? "";
if (args.length !== 1 || !/^[1-9]\d*$/.test(number)) {
  refuse("usage: node scripts/pr-merge.mjs <pr-number> (no other arguments)");
}

const pr = JSON.parse(
  execFileSync("gh", ["pr", "view", number, "--repo", REPO, "--json", "baseRefName,headRefName,state,isDraft,title"], {
    encoding: "utf8",
  }),
);

if (pr.state !== "OPEN") refuse(`#${number} is ${pr.state}, not OPEN`);
if (pr.isDraft) refuse(`#${number} is a draft: mark it ready for review first`);

const decision = decideMerge({ base: pr.baseRefName, head: pr.headRefName });
if ("refused" in decision) refuse(`#${number} ${decision.refused}`);

const mergeArgs = ["pr", "merge", number, "--repo", REPO, `--${decision.method}`];
if (decision.deleteBranch) mergeArgs.push("--delete-branch");
// A squash keeps GitHub's default message; a merge commit would otherwise read "Merge pull request #<n> from …".
if (decision.method === "merge") mergeArgs.push("--subject", `${pr.title} (#${number})`);

console.log(`gh ${mergeArgs.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(" ")}`);
execFileSync("gh", mergeArgs, { stdio: "inherit" });
