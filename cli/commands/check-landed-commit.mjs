import { readFileSync } from "node:fs";

import {
  AFTER_SEVERAL_COMMITS,
  carriedCommitLines,
  carriedSeveralCommits,
  LISTED_COMMIT_LIMIT,
  landedCommitProblem,
} from "../lib/branch-flow.mjs";
import { UsageError } from "../lib/errors.mjs";
import {
  readCommit,
  readPulls,
  readPushEvent,
  readPushedCommits,
} from "../lib/github-payloads.mjs";
import { loadBranchFlow } from "./repository-files.mjs";

/** @typedef {import("../lib/branch-flow.mjs").LandedCommit} LandedCommit */
/** @typedef {import("../lib/branch-flow.mjs").LandedPull} LandedPull */

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
  /** @param {string} sha */
  const readPullsOf = async (sha) =>
    readPulls(await getJson(`${commitsUrl}/${sha}/pulls?per_page=100`, token));
  const landed = {
    branch: event.branch,
    before: event.before,
    forced: event.forced,
    commit: readCommit(await getJson(`${commitsUrl}/${event.after}`, token)),
    pulls: await readPullsOf(event.after),
  };
  const problem = landedCommitProblem(landed, loadBranchFlow(process.cwd()));
  if (problem === null || !carriedSeveralCommits(landed)) return problem;
  const carried = await describeCarriedCommits(payload, landed, readPullsOf);
  return [problem, ...carried, AFTER_SEVERAL_COMMITS].join("\n");
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
