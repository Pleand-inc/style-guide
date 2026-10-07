import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY_ROOT = fileURLToPath(
  new URL("../../", import.meta.url),
);
export const CLI_PATH = join(REPOSITORY_ROOT, "cli", "style-guide.mjs");

const INHERITED_NAMES_TO_DROP = /^(GIT_|GITHUB_|BASE_REF$|HEAD_REF$)/;
const temporaryDirectories = [];

/**
 * The environment of every child process a test starts. It drops what a surrounding git hook or CI run sets, so a
 * test reads only what it passes, and it ignores the user's and the system's git configuration.
 * @param {Record<string, string>} extra
 */
export function isolatedEnvironment(extra = {}) {
  const inherited = Object.entries(process.env).filter(
    ([name]) => !INHERITED_NAMES_TO_DROP.test(name),
  );
  return {
    ...Object.fromEntries(inherited),
    // A fake executable written by a test starts with `#!/usr/bin/env node`.
    PATH: `${dirname(process.execPath)}:${process.env.PATH}`,
    GIT_CONFIG_GLOBAL: devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    ...extra,
  };
}

/** @param {string} namePrefix */
export function createTemporaryDirectory(namePrefix) {
  const directory = mkdtempSync(join(tmpdir(), namePrefix));
  temporaryDirectories.push(directory);
  return directory;
}

// node --test runs each test file in its own process, so a file's directories go when its process ends.
// Node 20.0.0 does not run a file-level `after` hook, and an exit handler runs on every version.
process.on("exit", () => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * @param {string} directory
 * @param {string[]} gitArguments
 */
export function git(directory, gitArguments) {
  return execFileSync("git", gitArguments, {
    cwd: directory,
    env: isolatedEnvironment(),
    encoding: "utf8",
  });
}

/**
 * @param {string} branch the branch HEAD points at; it has no commit yet
 * @returns {string} the directory of a new git repository
 */
export function createRepository(branch) {
  const directory = createTemporaryDirectory("style-guide-cli-");
  git(directory, ["init", "--quiet"]);
  git(directory, ["symbolic-ref", "HEAD", `refs/heads/${branch}`]);
  return directory;
}

/**
 * @param {string[]} cliArguments
 * @param {{ cwd?: string, env?: Record<string, string>, input?: string }} options
 */
export function runCli(cliArguments, options = {}) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...cliArguments], {
    cwd: options.cwd ?? REPOSITORY_ROOT,
    env: isolatedEnvironment(options.env),
    input: options.input ?? "",
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * Runs the command line without blocking this process, for a test that also serves the HTTP requests the command makes.
 * @param {string[]} cliArguments
 * @param {{ cwd?: string, env?: Record<string, string> }} options
 * @returns {Promise<{ status: number | null, stdout: string, stderr: string }>}
 */
export function runCliWithoutBlocking(cliArguments, options = {}) {
  const child = spawn(process.execPath, [CLI_PATH, ...cliArguments], {
    cwd: options.cwd ?? REPOSITORY_ROOT,
    env: isolatedEnvironment(options.env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = { stdout: "", stderr: "" };
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    output.stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    output.stderr += chunk;
  });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status) =>
      resolve({ status, stdout: output.stdout, stderr: output.stderr }),
    );
  });
}
