#!/usr/bin/env node
import { runCheck } from "./commands/check.mjs";
import { runCheckCommit } from "./commands/check-commit.mjs";
import { runCheckLandedCommit } from "./commands/check-landed-commit.mjs";
import { runCheckPullRequest } from "./commands/check-pull-request.mjs";
import { runCheckPush } from "./commands/check-push.mjs";
import { runInit } from "./commands/init.mjs";
import { runMerge } from "./commands/merge.mjs";
import { UsageError } from "./lib/errors.mjs";
import { USAGE } from "./lib/usage.mjs";

const EXIT_FAILED = 1;
const EXIT_UNUSABLE = 2;

/** @typedef {(commandArguments: string[]) => number | Promise<number>} Command */

/**
 * @param {string} name
 * @param {() => number | Promise<number>} run
 * @returns {[string, Command]}
 */
function withoutArguments(name, run) {
  return [
    name,
    (commandArguments) => {
      if (commandArguments.length === 0) return run();
      throw new UsageError(
        `${name} takes no arguments (got: ${commandArguments.join(" ")})`,
      );
    },
  ];
}

/** @type {Map<string, Command>} */
const COMMANDS = new Map([
  withoutArguments("init", runInit),
  withoutArguments("check", runCheck),
  withoutArguments("check-commit", runCheckCommit),
  withoutArguments("check-push", runCheckPush),
  withoutArguments("check-pull-request", runCheckPullRequest),
  withoutArguments("check-landed-commit", runCheckLandedCommit),
  ["merge", runMerge],
]);

/**
 * @param {string} name
 * @param {unknown} error
 * @returns {number} the exit status for a command that threw
 */
function reportFailure(name, error) {
  if (error instanceof UsageError) {
    console.error(`style-guide: ${error.message}`);
    return EXIT_UNUSABLE;
  }
  console.error(
    `style-guide ${name}: ${error instanceof Error ? error.message : String(error)}`,
  );
  return EXIT_FAILED;
}

/**
 * @param {string[]} commandLine
 * @returns {Promise<number>} the exit status
 */
async function main([name, ...commandArguments]) {
  if (name === undefined || name === "--help" || name === "-h") {
    console.log(USAGE);
    return 0;
  }
  const command = COMMANDS.get(name);
  if (command === undefined) {
    console.error(`style-guide: unknown command '${name}'\n\n${USAGE}`);
    return EXIT_UNUSABLE;
  }
  try {
    return await command(commandArguments);
  } catch (error) {
    return reportFailure(name, error);
  }
}

process.exitCode = await main(process.argv.slice(2));
