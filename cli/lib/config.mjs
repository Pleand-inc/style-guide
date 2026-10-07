// Reads the optional `style-guide.config.json` of a consuming repository (no I/O: the caller passes the text).

import { isProtectedBranch, isWorkBranch } from "./branch-flow.mjs";
import { ConfigError } from "./errors.mjs";
import { isRecord } from "./values.mjs";

/**
 * @typedef {object} BranchFlow
 * @property {readonly string[]} workBranchPrefixes a work branch is `<prefix>/<slug>`
 * @property {readonly string[]} longLivedBranches branches that take pushes but never head a pull request
 */

export const CONFIG_FILE_NAME = "style-guide.config.json";

/** @type {BranchFlow} */
export const DEFAULT_BRANCH_FLOW = Object.freeze({
  workBranchPrefixes: Object.freeze(["feat", "fix", "chore", "docs"]),
  longLivedBranches: Object.freeze([]),
});

const PREFIX = /^[A-Za-z0-9._-]+$/;
const BRANCH_NAME = /^\S+$/;
const PREFIXES_KEY = "branchFlow.workBranchPrefixes";
const LONG_LIVED_KEY = "branchFlow.longLivedBranches";

/** @param {string} message */
function configError(message) {
  return new ConfigError(`${CONFIG_FILE_NAME}: ${message}`);
}

/**
 * @param {Record<string, unknown>} record
 * @param {readonly string[]} knownKeys
 * @param {string} keyPrefix the path of `record` inside the file, ending in a dot, or "" for the top level
 */
function rejectUnknownKeys(record, knownKeys, keyPrefix) {
  for (const key of Object.keys(record)) {
    if (knownKeys.includes(key)) continue;
    throw configError(
      `unknown key '${keyPrefix}${key}' (known: ${knownKeys.map((known) => keyPrefix + known).join(", ")})`,
    );
  }
}

/**
 * @param {unknown} value
 * @param {string} key
 * @returns {unknown[]}
 */
function requireArray(value, key) {
  if (!Array.isArray(value))
    throw configError(`'${key}' must be an array of strings`);
  return value;
}

/**
 * @param {unknown} value
 * @returns {readonly string[]}
 */
function readWorkBranchPrefixes(value) {
  if (value === undefined) return DEFAULT_BRANCH_FLOW.workBranchPrefixes;
  const entries = requireArray(value, PREFIXES_KEY);
  if (entries.length === 0)
    throw configError(`'${PREFIXES_KEY}' must list at least one prefix`);
  return entries.map((entry, index) => {
    if (typeof entry === "string" && PREFIX.test(entry)) return entry;
    throw configError(
      `'${PREFIXES_KEY}[${index}]' must be a string of letters, digits, '.', '_' or '-'`,
    );
  });
}

/**
 * @param {unknown} entry
 * @param {string} key
 * @param {readonly string[]} workBranchPrefixes
 * @returns {string}
 */
function readLongLivedBranch(entry, key, workBranchPrefixes) {
  if (typeof entry !== "string" || !BRANCH_NAME.test(entry)) {
    throw configError(
      `'${key}' must be a branch name: a string without spaces`,
    );
  }
  if (isProtectedBranch(entry)) {
    throw configError(
      `'${key}' is '${entry}': master and develop change only through pull requests`,
    );
  }
  if (isWorkBranch(entry, workBranchPrefixes)) {
    throw configError(
      `'${key}' is '${entry}', which is also a work branch name`,
    );
  }
  return entry;
}

/**
 * @param {unknown} value
 * @param {readonly string[]} workBranchPrefixes
 * @returns {readonly string[]}
 */
function readLongLivedBranches(value, workBranchPrefixes) {
  if (value === undefined) return DEFAULT_BRANCH_FLOW.longLivedBranches;
  return requireArray(value, LONG_LIVED_KEY).map((entry, index) =>
    readLongLivedBranch(
      entry,
      `${LONG_LIVED_KEY}[${index}]`,
      workBranchPrefixes,
    ),
  );
}

/**
 * @param {string} text
 * @returns {Record<string, unknown>}
 */
function parseTopLevelObject(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw configError(
      `not valid JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (!isRecord(parsed)) throw configError("the top level must be an object");
  return parsed;
}

/**
 * @param {string} text the content of `style-guide.config.json`
 * @returns {BranchFlow} the configured lists, each falling back to its default when the file leaves it out
 * @throws {ConfigError} naming the key that cannot be used
 */
export function parseBranchFlowConfig(text) {
  const topLevel = parseTopLevelObject(text);
  rejectUnknownKeys(topLevel, ["branchFlow"], "");
  if (topLevel.branchFlow === undefined) return DEFAULT_BRANCH_FLOW;
  if (!isRecord(topLevel.branchFlow))
    throw configError("'branchFlow' must be an object");
  rejectUnknownKeys(
    topLevel.branchFlow,
    ["workBranchPrefixes", "longLivedBranches"],
    "branchFlow.",
  );
  const workBranchPrefixes = readWorkBranchPrefixes(
    topLevel.branchFlow.workBranchPrefixes,
  );
  const longLivedBranches = readLongLivedBranches(
    topLevel.branchFlow.longLivedBranches,
    workBranchPrefixes,
  );
  return { workBranchPrefixes, longLivedBranches };
}
