import { readFileSync } from "node:fs";

import {
  AFTER_SEVERAL_COMMITS,
  canBeRebaseMergeOf,
  carriedCommitLines,
  carriedSeveralCommits,
  LISTED_COMMIT_LIMIT,
  landedCommitProblem,
  nextCommitToWalk,
  rebaseMergeCandidate,
  unwalkedRebaseMergeLine,
} from "../lib/branch-flow.mjs";
import { UsageError } from "../lib/errors.mjs";
import {
  isStackedPullRequest,
  readCommit,
  readCommitIdentity,
  readPullRequestCommitCount,
  readPullRequestCommits,
  readPullRequestHeadSha,
  readPulls,
  readPushEvent,
  readPushedCommits,
} from "../lib/github-payloads.mjs";
import { loadBranchFlow } from "./repository-files.mjs";

/** @typedef {import("../lib/branch-flow.mjs").CommitIdentity} CommitIdentity */
/** @typedef {import("../lib/branch-flow.mjs").LandedCommit} LandedCommit */
/** @typedef {import("../lib/branch-flow.mjs").LandedPull} LandedPull */
/** @typedef {import("../lib/branch-flow.mjs").RebasedPull} RebasedPull */
/** @typedef {import("../lib/branch-flow.mjs").RebaseWalk} RebaseWalk */
/** @typedef {import("../lib/branch-flow.mjs").WalkedCommit} WalkedCommit */
/** @typedef {import("../lib/config.mjs").BranchFlow} BranchFlow */
/**
 * @typedef {object} GitHubReads
 * @property {(sha: string) => Promise<WalkedCommit>} walkedCommitOf
 * @property {(sha: string) => Promise<LandedPull[]>} pullsOf the pull requests GitHub associates with the commit
 * @property {(number: number) => Promise<RebasedPull>} pullOf
 * @property {(number: number) => Promise<CommitIdentity[]>} pullCommitsOf the pull request's commits, the oldest first
 */
/**
 * @typedef {object} CheckedPush
 * @property {LandedCommit} landed the push, with the walk when the check walked it as a rebase merge
 * @property {string | null} uncheckedRebaseLine the line that says why the check did not establish whether the push is
 *   the rebase merge of the pull request rebaseMergeCandidate names, or null
 */

const PUBLIC_API_URL = "https://api.github.com";

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnvironment(name) {
  const value = process.env[name];
  if (value !== undefined && value !== "") return value;
  throw new UsageError(`check-landed-commit needs ${name} in the environment`);
}

/**
 * @param {string} url
 * @param {string} token
 * @returns {Promise<unknown>}
 */
async function getJson(url, token) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "style-guide-cli",
    },
  });
  if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
  return response.json();
}

/**
 * @param {unknown} payload the parsed push event
 * @param {LandedCommit} landed
 * @param {(sha: string) => Promise<LandedPull[]>} readPullsOf
 * @returns {Promise<string[]>} the lines that name the commits the push carried, or the line that says why they are
 *   not named; the check has already failed, so nothing here changes its result
 */
async function describeCarriedCommits(payload, landed, readPullsOf) {
  try {
    const pushed = readPushedCommits(payload);
    const listed = [];
    for (const { sha, subject } of pushed.slice(0, LISTED_COMMIT_LIMIT)) {
      const pulls =
        sha === landed.commit.sha ? landed.pulls : await readPullsOf(sha);
      listed.push({ sha, subject, pulls });
    }
    return carriedCommitLines(listed, pushed.length);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return [`The commits the push carried could not be listed: ${reason}`];
  }
}

/**
 * Reads, for a push that may be the rebase merge of one pull request into develop, that pull request, its commits and
 * the commits on the first-parent walk down from the tip, as far as nextCommitToWalk leads. A read that fails leaves
 * the push without the walk, so it fails as any other push of several commits, with one more line that says why.
 * @param {LandedCommit} landed
 * @param {BranchFlow} branchFlow
 * @param {GitHubReads} read
 * @returns {Promise<CheckedPush>}
 */
async function withRebaseWalk(landed, branchFlow, read) {
  const candidate = rebaseMergeCandidate(landed, branchFlow);
  if (candidate === undefined) return { landed, uncheckedRebaseLine: null };
  try {
    const pull = await read.pullOf(candidate.number);
    if (!canBeRebaseMergeOf(pull, landed.commit.sha))
      return { landed, uncheckedRebaseLine: unwalkedRebaseMergeLine(pull) };
    /** @type {RebaseWalk} */
    const rebaseWalk = {
      pull,
      pullCommits: await read.pullCommitsOf(pull.number),
      firstParents: [await read.walkedCommitOf(landed.commit.sha)],
    };
    let sha = nextCommitToWalk(rebaseWalk, landed.before);
    while (sha !== null) {
      rebaseWalk.firstParents.push(await read.walkedCommitOf(sha));
      sha = nextCommitToWalk(rebaseWalk, landed.before);
    }
    return { landed: { ...landed, rebaseWalk }, uncheckedRebaseLine: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      landed,
      uncheckedRebaseLine: `Whether the push is the rebase merge of #${candidate.number} could not be checked: ${reason}`,
    };
  }
}

/**
 * @param {import("../lib/github-payloads.mjs").PushEvent} event
 * @param {unknown} payload the parsed push event that `event` was read from
 * @returns {Promise<string | null>} why the push breaks the flow, or null
 */
async function pushProblem(event, payload) {
  if (event.deleted) return `${event.branch} was deleted`;
  const repository = requireEnvironment("GITHUB_REPOSITORY");
  const token = requireEnvironment("GITHUB_TOKEN");
  // GitHub Actions sets GITHUB_API_URL; on GitHub Enterprise Server it is not the public address.
  const apiUrl = process.env.GITHUB_API_URL || PUBLIC_API_URL;
  const commitsUrl = `${apiUrl}/repos/${repository}/commits`;
  const pullsUrl = `${apiUrl}/repos/${repository}/pulls`;
  const tipResponse = await getJson(`${commitsUrl}/${event.after}`, token);
  /** @type {GitHubReads} */
  const read = {
    // The walk starts at the tip, whose response is already here.
    walkedCommitOf: async (sha) => {
      const response =
        sha === event.after
          ? tipResponse
          : await getJson(`${commitsUrl}/${sha}`, token);
      return { ...readCommit(response), ...readCommitIdentity(response) };
    },
    pullsOf: async (sha) =>
      readPulls(
        await getJson(`${commitsUrl}/${sha}/pulls?per_page=100`, token),
      ),
    // The pull requests a commit lists lack the commit count; only the response for one pull request has it.
    pullOf: async (number) => {
      const response = await getJson(`${pullsUrl}/${number}`, token);
      return {
        number,
        commits: readPullRequestCommitCount(response),
        headSha: readPullRequestHeadSha(response),
        stacked: isStackedPullRequest(response),
      };
    },
    // canBeRebaseMergeOf lets through at most REBASE_MERGE_COMMIT_LIMIT commits, which one page of 100 holds.
    pullCommitsOf: async (number) =>
      readPullRequestCommits(
        await getJson(`${pullsUrl}/${number}/commits?per_page=100`, token),
      ),
  };
  /** @type {LandedCommit} */
  const tip = {
    branch: event.branch,
    before: event.before,
    forced: event.forced,
    commit: readCommit(tipResponse),
    pulls: await read.pullsOf(event.after),
  };
  const branchFlow = loadBranchFlow(process.cwd());
  const { landed, uncheckedRebaseLine } = await withRebaseWalk(
    tip,
    branchFlow,
    read,
  );
  const problem = landedCommitProblem(landed, branchFlow);
  if (problem === null || !carriedSeveralCommits(landed)) return problem;
  const carried = await describeCarriedCommits(payload, landed, read.pullsOf);
  const lines = [problem, ...carried];
  if (uncheckedRebaseLine !== null) lines.push(uncheckedRebaseLine);
  return [...lines, AFTER_SEVERAL_COMMITS].join("\n");
}

/** @returns {Promise<number>} the exit status of the check on a push to master or develop */
export async function runCheckLandedCommit() {
  const eventText = readFileSync(
    requireEnvironment("GITHUB_EVENT_PATH"),
    "utf8",
  );
  /** @type {unknown} */
  const payload = JSON.parse(eventText);
  const event = readPushEvent(payload);
  const problem = await pushProblem(event, payload);
  if (problem !== null) {
    console.error(`style-guide check-landed-commit: ${problem}`);
    return 1;
  }
  console.log(
    `style-guide check-landed-commit: ${event.after} landed on ${event.branch} through a pull request`,
  );
  return 0;
}
