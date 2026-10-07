import { readFileSync } from "node:fs";

import { landedCommitProblem } from "../lib/branch-flow.mjs";
import { UsageError } from "../lib/errors.mjs";
import {
  readCommit,
  readPulls,
  readPushEvent,
} from "../lib/github-payloads.mjs";
import { loadBranchFlow } from "./repository-files.mjs";

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
 * @param {import("../lib/github-payloads.mjs").PushEvent} event
 * @returns {Promise<string | null>} why the push breaks the flow, or null
 */
async function pushProblem(event) {
  if (event.deleted) return `${event.branch} was deleted`;
  const repository = requireEnvironment("GITHUB_REPOSITORY");
  const token = requireEnvironment("GITHUB_TOKEN");
  // GitHub Actions sets GITHUB_API_URL; on GitHub Enterprise Server it is not the public address.
  const apiUrl = process.env.GITHUB_API_URL || PUBLIC_API_URL;
  const commitUrl = `${apiUrl}/repos/${repository}/commits/${event.after}`;
  const landed = {
    branch: event.branch,
    before: event.before,
    forced: event.forced,
    commit: readCommit(await getJson(commitUrl, token)),
    pulls: readPulls(await getJson(`${commitUrl}/pulls?per_page=100`, token)),
  };
  return landedCommitProblem(landed, loadBranchFlow(process.cwd()));
}

/** @returns {Promise<number>} the exit status of the check on a push to master or develop */
export async function runCheckLandedCommit() {
  const eventText = readFileSync(
    requireEnvironment("GITHUB_EVENT_PATH"),
    "utf8",
  );
  const event = readPushEvent(JSON.parse(eventText));
  const problem = await pushProblem(event);
  if (problem !== null) {
    console.error(`style-guide check-landed-commit: ${problem}`);
    return 1;
  }
  console.log(
    `style-guide check-landed-commit: ${event.after} landed on ${event.branch} through a pull request`,
  );
  return 0;
}
