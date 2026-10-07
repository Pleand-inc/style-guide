// Reads what the commands need from the repository in the working directory and from the installed package.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONFIG_FILE_NAME,
  DEFAULT_BRANCH_FLOW,
  parseBranchFlowConfig,
} from "../lib/config.mjs";
import { UsageError } from "../lib/errors.mjs";
import { INSPECTED_PATHS } from "../lib/setup.mjs";

const PACKAGE_RULES_DIRECTORY = fileURLToPath(
  new URL("../../rules/", import.meta.url),
);

/**
 * @param {string} path
 * @returns {string | undefined}
 */
function readTextIfPresent(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

/**
 * @param {string} directory the repository root
 * @returns {import("../lib/config.mjs").BranchFlow}
 */
export function loadBranchFlow(directory) {
  const text = readTextIfPresent(join(directory, CONFIG_FILE_NAME));
  return text === undefined ? DEFAULT_BRANCH_FLOW : parseBranchFlowConfig(text);
}

/**
 * @param {string} directory the repository root
 * @returns {Map<string, string>} the text of each path the setup inspection reads, for the paths that exist
 */
export function readRepositoryFiles(directory) {
  const files = new Map();
  for (const path of INSPECTED_PATHS) {
    const text = readTextIfPresent(join(directory, path));
    if (text !== undefined) files.set(path, text);
  }
  return files;
}

/**
 * @param {string} directory
 * @param {string} pathPrefix
 * @returns {string[]}
 */
function listFilesUnder(directory, pathPrefix) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${pathPrefix}${entry.name}`;
    if (entry.isDirectory())
      files.push(...listFilesUnder(join(directory, entry.name), `${path}/`));
    else files.push(path);
  }
  return files;
}

/** @returns {string[]} every file under the `rules/` directory of the package this command runs from, sorted */
export function listPackageRuleFiles() {
  return listFilesUnder(PACKAGE_RULES_DIRECTORY, "").sort();
}

/**
 * @param {string} directory
 * @param {string} command
 */
export function requireRepositoryRoot(directory, command) {
  if (existsSync(join(directory, ".git"))) return;
  throw new UsageError(
    `${command} runs from the repository root: there is no .git in ${directory}`,
  );
}
