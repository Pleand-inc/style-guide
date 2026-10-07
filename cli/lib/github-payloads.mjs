// Checks the shape of what GitHub and the gh CLI hand over before the branch-flow rules read it (no I/O).

import { isRecord } from "./values.mjs";

/** @typedef {import("./branch-flow.mjs").LandedPull} LandedPull */
/**
 * @typedef {object} PushEvent
 * @property {"master" | "develop"} branch
 * @property {string} before
 * @property {string} after
 * @property {boolean} forced
 * @property {boolean} deleted
 */
/**
 * @typedef {object} PullRequestView
 * @property {string} base
 * @property {string} head
 * @property {string} state `OPEN`, `CLOSED` or `MERGED`
 * @property {boolean} isDraft
 * @property {string} title
 */

const HEADS = "refs/heads/";

/**
 * @param {unknown} value
 * @param {string} description what the value is, for the error message
 * @returns {Record<string, unknown>}
 */
function requireRecord(value, description) {
  if (isRecord(value)) return value;
  throw new Error(`${description} is not an object`);
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {string} description
 * @returns {string}
 */
function requireString(record, key, description) {
  const value = record[key];
  if (typeof value === "string") return value;
  throw new Error(`${description} has no string '${key}'`);
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {string} description
 * @returns {boolean}
 */
function requireBoolean(record, key, description) {
  const value = record[key];
  if (typeof value === "boolean") return value;
  throw new Error(`${description} has no boolean '${key}'`);
}

/**
 * @param {unknown} value
 * @param {string} description
 * @returns {unknown[]}
 */
function requireArray(value, description) {
  if (Array.isArray(value)) return value;
  throw new Error(`${description} is not an array`);
}

/**
 * @param {string} ref
 * @returns {"master" | "develop"}
 */
function protectedBranchOf(ref) {
  const branch = ref.startsWith(HEADS) ? ref.slice(HEADS.length) : "";
  if (branch === "master" || branch === "develop") return branch;
  throw new Error(
    `the push event is for '${ref}': this check runs on pushes to master and develop only`,
  );
}

/**
 * @param {unknown} payload the parsed file at `GITHUB_EVENT_PATH` of a `push` workflow run
 * @returns {PushEvent}
 */
export function readPushEvent(payload) {
  const description = "the push event";
  const event = requireRecord(payload, description);
  return {
    branch: protectedBranchOf(requireString(event, "ref", description)),
    before: requireString(event, "before", description),
    after: requireString(event, "after", description),
    forced: requireBoolean(event, "forced", description),
    deleted: requireBoolean(event, "deleted", description),
  };
}

/**
 * @param {unknown} payload the response of `GET /repos/{owner}/{repo}/commits/{ref}`
 * @returns {{ sha: string, parents: string[] }}
 */
export function readCommit(payload) {
  const description = "the commit response";
  const commit = requireRecord(payload, description);
  const parents = requireArray(commit.parents, `${description}'s 'parents'`);
  return {
    sha: requireString(commit, "sha", description),
    parents: parents.map((parent) =>
      requireString(requireRecord(parent, "a parent"), "sha", "a parent"),
    ),
  };
}

/**
 * @param {unknown} entry
 * @returns {LandedPull}
 */
function readPull(entry) {
  const description = "a pull request of the commit";
  const pull = requireRecord(entry, description);
  if (typeof pull.number !== "number")
    throw new Error(`${description} has no numeric 'number'`);
  const mergeCommitSha = pull.merge_commit_sha;
  return {
    number: pull.number,
    base: requireString(
      requireRecord(pull.base, `${description}'s 'base'`),
      "ref",
      `${description}'s 'base'`,
    ),
    head: requireString(
      requireRecord(pull.head, `${description}'s 'head'`),
      "ref",
      `${description}'s 'head'`,
    ),
    mergeCommitSha: typeof mergeCommitSha === "string" ? mergeCommitSha : null,
    merged: typeof pull.merged_at === "string",
  };
}

/**
 * @param {unknown} payload the response of `GET /repos/{owner}/{repo}/commits/{ref}/pulls`
 * @returns {LandedPull[]}
 */
export function readPulls(payload) {
  return requireArray(payload, "the pull requests response").map(readPull);
}

/**
 * @param {unknown} payload the output of `gh pr view --json baseRefName,headRefName,state,isDraft,title`
 * @returns {PullRequestView}
 */
export function readPullRequestView(payload) {
  const description = "the gh pr view output";
  const view = requireRecord(payload, description);
  return {
    base: requireString(view, "baseRefName", description),
    head: requireString(view, "headRefName", description),
    state: requireString(view, "state", description),
    isDraft: requireBoolean(view, "isDraft", description),
    title: requireString(view, "title", description),
  };
}

/**
 * @param {unknown} payload the response of `GET /repos/{owner}/{repo}/pulls/{number}`
 * @returns {boolean} whether the pull request is part of a GitHub stack; the REST pull request sets `stack` only then
 */
export function isStackedPullRequest(payload) {
  return Boolean(requireRecord(payload, "the pull request response").stack);
}
