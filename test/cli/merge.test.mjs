// Runs `style-guide merge` against a stand-in for the gh CLI that records how it was called and answers from a
// scenario file, so the test covers the order of the calls without a GitHub repository.

import assert from "node:assert/strict";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  createRepository,
  createTemporaryDirectory,
  git,
  isolatedEnvironment,
  runCli,
} from "./helpers.mjs";

const FAKE_GH = `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require("node:fs");

const commandLine = process.argv.slice(2);
const scenario = JSON.parse(readFileSync(process.env.FAKE_GH_SCENARIO, "utf8"));
const earlierCalls = readFileSync(process.env.FAKE_GH_LOG, "utf8");
appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(commandLine) + "\\n");

const [first, second] = commandLine;
if (first === "--version" && scenario.versionFails) process.exit(127);
if (second === "merge" && scenario.mergeFails) process.exit(1);
if (first === "pr" && second === "view") {
  const mergeRan = earlierCalls.includes('","merge",');
  console.log(JSON.stringify(mergeRan ? scenario.viewAfterMerge : scenario.view));
}
if (first === "api" && commandLine.length === 2) console.log(JSON.stringify(scenario.pull));
if (first === "api" && commandLine[2] === "DELETE" && scenario.deleteAnswer) {
  process.stdout.write(scenario.deleteAnswer.stdout);
  process.stderr.write(scenario.deleteAnswer.stderr);
  process.exit(scenario.deleteAnswer.status);
}
`;

const SSH_ORIGIN = "git@github.com:acme/web.git";
const HTTPS_ORIGIN = "https://github.com/acme/web.git";
const VERSION_CALL = ["--version"];
const VIEW_CALL = [
  "pr",
  "view",
  "12",
  "--repo",
  "acme/web",
  "--json",
  "baseRefName,headRefName,state,isDraft,title",
];
const PULL_CALL = ["api", "repos/acme/web/pulls/12"];
const SQUASH_CALL = [
  "pr",
  "merge",
  "12",
  "--repo",
  "acme/web",
  "--squash",
  "--delete-branch",
];
const STACK_MERGE_CALL = ["stack", "merge", "12", "--squash", "--yes"];
const DELETE_HEAD_CALL = [
  "api",
  "-X",
  "DELETE",
  "repos/acme/web/git/refs/heads/feat/login",
];
const OPEN_WORK_BRANCH = {
  baseRefName: "develop",
  headRefName: "feat/login",
  state: "OPEN",
  isDraft: false,
  title: "feat: add the login form",
};
const PLAIN = { view: OPEN_WORK_BRANCH, pull: { number: 12 } };
const STACKED = {
  view: OPEN_WORK_BRANCH,
  viewAfterMerge: { ...OPEN_WORK_BRANCH, state: "MERGED" },
  pull: { number: 12, stack: { id: 3 } },
};
/**
 * What `gh api` does when GitHub answers with an HTTP error: the response body on stdout, `gh: <message> (HTTP
 * <status>)` on stderr, exit 1 (processResponse and parseErrorResponse in the gh CLI's pkg/cmd/api/api.go).
 * @param {number} status
 * @param {string} message
 */
function ghApiHttpError(status, message) {
  return {
    stdout: JSON.stringify({ message, status: String(status) }),
    stderr: `gh: ${message} (HTTP ${status})\n`,
    status: 1,
  };
}
const GONE_422 = "gh: Reference does not exist (HTTP 422)";
const ALREADY_DELETED_ANSWERS = [
  {
    name: "HTTP 422 Reference does not exist",
    answer: ghApiHttpError(422, "Reference does not exist"),
    said: "feat/login was already deleted: GitHub answered HTTP 422\n",
  },
  {
    name: "HTTP 404 Reference does not exist",
    answer: ghApiHttpError(404, "Reference does not exist"),
    said: "feat/login was already deleted: GitHub answered HTTP 404\n",
  },
  {
    name: "that line after another line",
    answer: { stdout: "", stderr: `warning: x\n${GONE_422}\n`, status: 1 },
    said: "feat/login was already deleted: GitHub answered HTTP 422\n",
  },
  {
    // gh may print a scope hint on the line after the error (processResponse in the gh CLI's pkg/cmd/api/api.go).
    name: "that line before a scope hint",
    answer: {
      stdout: "",
      stderr:
        "gh: Reference does not exist (HTTP 404)\n" +
        'gh: This API operation needs the "repo" scope. To request it, run:  gh auth refresh -h github.com -s repo\n',
      status: 1,
    },
    said: "feat/login was already deleted: GitHub answered HTTP 404\n",
  },
];
const FAILED_DELETE_ANSWERS = [
  {
    name: "HTTP 403",
    answer: ghApiHttpError(403, "Resource not accessible by integration"),
  },
  {
    // GitHub's REST docs give 422 for "Delete a reference" also when validation fails.
    name: "HTTP 422 Validation Failed",
    answer: ghApiHttpError(422, "Validation Failed"),
  },
  {
    // GitHub's REST docs list 409 for "Delete a reference" too; only 422 and 404 with this message count as gone.
    name: "HTTP 409 Reference does not exist",
    answer: ghApiHttpError(409, "Reference does not exist"),
  },
  {
    // gh prints the bare status when it finds no message in the body: nothing says the branch is gone.
    name: "HTTP 404 with no message",
    answer: { stdout: "", stderr: "gh: HTTP 404\n", status: 1 },
  },
  {
    // A message over several lines leaves ` (HTTP 422)` alone on the last line.
    name: "an HTTP 422 message over several lines",
    answer: ghApiHttpError(
      422,
      "Repository rule violations found\n\nCannot delete this branch\n\n",
    ),
  },
  {
    name: "text before gh: on the Reference does not exist line",
    answer: { stdout: "", stderr: `x ${GONE_422}\n`, status: 1 },
  },
  {
    name: "text after the status on the Reference does not exist line",
    answer: { stdout: "", stderr: `${GONE_422} x\n`, status: 1 },
  },
  {
    // What gh prints when it cannot resolve the API host (printError in the gh CLI's internal/ghcmd/cmd.go).
    name: "a network error",
    answer: {
      stdout: "",
      stderr:
        "error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com\n",
      status: 1,
    },
  },
];
const REFUSED_PULL_REQUESTS = [
  {
    name: "a closed pull request",
    view: { state: "CLOSED" },
    reason: /#12 is CLOSED, not OPEN/,
  },
  {
    name: "a merged pull request",
    view: { state: "MERGED" },
    reason: /#12 is MERGED, not OPEN/,
  },
  { name: "a draft", view: { isDraft: true }, reason: /#12 is a draft/ },
  {
    name: "a work branch into master",
    view: { baseRefName: "master" },
    reason: /master takes only develop/,
  },
  {
    name: "a head outside the flow",
    view: { headRefName: "wip" },
    reason: /the head must be feat\|fix/,
  },
  {
    name: "a stack layer that is not the lowest",
    view: { baseRefName: "feat/base" },
    reason: /base 'feat\/base' is not part of the flow/,
  },
];
const UNUSABLE_ARGUMENTS = [
  [],
  ["twelve"],
  ["0"],
  ["12", "13"],
  ["12", "--admin"],
  ["-12"],
];

const fakeBinDirectory = createTemporaryDirectory("style-guide-fake-gh-");
writeFileSync(join(fakeBinDirectory, "gh"), FAKE_GH);
chmodSync(join(fakeBinDirectory, "gh"), 0o755);

/** @param {string | null} originUrl */
function createCheckout(originUrl) {
  const directory = createRepository("feat/login");
  if (originUrl !== null) {
    git(directory, ["remote", "add", "origin", originUrl]);
  }
  return directory;
}

/**
 * @param {string} directory
 * @param {object} scenario what the stand-in gh answers
 * @param {{ cliArguments?: string[], env?: Record<string, string> }} options
 */
function runMerge(directory, scenario, options = {}) {
  const scratch = createTemporaryDirectory("style-guide-merge-");
  const logPath = join(scratch, "calls.jsonl");
  writeFileSync(logPath, "");
  writeFileSync(join(scratch, "scenario.json"), JSON.stringify(scenario));
  const result = runCli(["merge", ...(options.cliArguments ?? ["12"])], {
    cwd: directory,
    env: {
      PATH: `${fakeBinDirectory}:${isolatedEnvironment().PATH}`,
      FAKE_GH_SCENARIO: join(scratch, "scenario.json"),
      FAKE_GH_LOG: logPath,
      ...options.env,
    },
  });
  const calls = readFileSync(logPath, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));
  return { ...result, calls };
}

describe("style-guide merge: a pull request outside a stack", () => {
  it("squashes a work branch into develop, deletes the branch, and takes the repository from origin", () => {
    const result = runMerge(createCheckout(SSH_ORIGIN), PLAIN);
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
    assert.deepEqual(result.calls, [
      VERSION_CALL,
      VIEW_CALL,
      PULL_CALL,
      SQUASH_CALL,
    ]);
    assert.equal(
      result.stdout,
      "gh pr merge 12 --repo acme/web --squash --delete-branch\n",
    );
  });

  it("reads an https origin with or without .git", () => {
    for (const origin of [HTTPS_ORIGIN, "https://github.com/acme/web"]) {
      const result = runMerge(createCheckout(origin), PLAIN);
      assert.equal(result.status, 0, origin);
      assert.deepEqual(result.calls.at(-1), SQUASH_CALL);
    }
  });

  it("merges develop into master with a merge commit titled '<title> (#<number>)' and keeps develop", () => {
    const view = {
      ...OPEN_WORK_BRANCH,
      baseRefName: "master",
      headRefName: "develop",
      title: "release: login",
    };
    const scenario = { view, pull: { number: 12 } };
    const result = runMerge(createCheckout(SSH_ORIGIN), scenario);
    assert.equal(result.status, 0);
    assert.deepEqual(result.calls.at(-1), [
      "pr",
      "merge",
      "12",
      "--repo",
      "acme/web",
      "--merge",
      "--subject",
      "release: login (#12)",
    ]);
    assert.equal(
      result.stdout,
      'gh pr merge 12 --repo acme/web --merge --subject "release: login (#12)"\n',
    );
  });

  it("takes GITHUB_REPOSITORY before origin", () => {
    const result = runMerge(createCheckout(SSH_ORIGIN), PLAIN, {
      env: { GITHUB_REPOSITORY: "acme/api" },
    });
    assert.equal(result.status, 0);
    assert.deepEqual(
      result.calls.at(-1),
      SQUASH_CALL.map((argument) =>
        argument === "acme/web" ? "acme/api" : argument,
      ),
    );
  });

  it("follows style-guide.config.json for the head's prefix", () => {
    const directory = createCheckout(SSH_ORIGIN);
    const view = { ...OPEN_WORK_BRANCH, headRefName: "ops/deploy" };
    const scenario = { view, pull: { number: 12 } };
    assert.equal(runMerge(directory, scenario).status, 1);
    writeFileSync(
      join(directory, "style-guide.config.json"),
      JSON.stringify({ branchFlow: { workBranchPrefixes: ["feat", "ops"] } }),
    );
    assert.equal(runMerge(directory, scenario).status, 0);
  });
});

describe("style-guide merge: a stacked pull request", () => {
  it("merges through gh stack merge and deletes the head once the pull request reads as merged", () => {
    const result = runMerge(createCheckout(HTTPS_ORIGIN), STACKED);
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
    assert.deepEqual(result.calls, [
      VERSION_CALL,
      VIEW_CALL,
      PULL_CALL,
      STACK_MERGE_CALL,
      VIEW_CALL,
      DELETE_HEAD_CALL,
    ]);
    assert.equal(
      result.stdout,
      "gh stack merge 12 --squash --yes\n" +
        "gh api -X DELETE repos/acme/web/git/refs/heads/feat/login\n",
    );
  });

  for (const { name, answer, said } of ALREADY_DELETED_ANSWERS) {
    it(`takes the head branch as deleted when the DELETE answers ${name}, and exits 0`, () => {
      const scenario = { ...STACKED, deleteAnswer: answer };
      const result = runMerge(createCheckout(HTTPS_ORIGIN), scenario);
      assert.equal(result.stderr, "");
      assert.equal(result.status, 0);
      assert.deepEqual(result.calls.at(-1), DELETE_HEAD_CALL);
      assert.equal(
        result.stdout,
        "gh stack merge 12 --squash --yes\n" +
          "gh api -X DELETE repos/acme/web/git/refs/heads/feat/login\n" +
          said,
      );
    });
  }

  for (const { name, answer } of FAILED_DELETE_ANSWERS) {
    it(`exits 1 and passes on what gh printed when the DELETE fails with ${name}`, () => {
      const scenario = { ...STACKED, deleteAnswer: answer };
      const result = runMerge(createCheckout(HTTPS_ORIGIN), scenario);
      assert.equal(result.status, 1);
      assert.deepEqual(result.calls.at(-1), DELETE_HEAD_CALL);
      assert.ok(result.stderr.startsWith(answer.stderr), result.stderr);
      assert.match(
        result.stderr,
        /^style-guide merge: Command failed: gh api -X DELETE repos\/acme\/web\/git\/refs\/heads\/feat\/login$/m,
      );
      assert.ok(result.stdout.endsWith(answer.stdout), result.stdout);
      assert.doesNotMatch(result.stdout, /already deleted/);
    });
  }

  it("keeps the head branch when the pull request does not read as merged yet, and exits 1", () => {
    const scenario = { ...STACKED, viewAfterMerge: OPEN_WORK_BRANCH };
    const result = runMerge(createCheckout(HTTPS_ORIGIN), scenario);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /#12 is OPEN after the merge, not MERGED: delete feat\/login once it merges/,
    );
    assert.deepEqual(result.calls.at(-1), VIEW_CALL);
  });

  it("refuses when origin is not the repository it acts on", () => {
    const directory = createCheckout("git@github.com:acme/api.git");
    const result = runMerge(directory, STACKED, {
      env: { GITHUB_REPOSITORY: "acme/web" },
    });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /#12 is in a stack and gh stack merge has no --repo flag/,
    );
    assert.deepEqual(result.calls, [VERSION_CALL, VIEW_CALL, PULL_CALL]);
  });

  it("exits 1 when the merge itself fails, and deletes nothing", () => {
    const scenario = { ...STACKED, mergeFails: true };
    const result = runMerge(createCheckout(SSH_ORIGIN), scenario);
    assert.equal(result.status, 1);
    assert.deepEqual(result.calls.at(-1), STACK_MERGE_CALL);
  });
});

describe("style-guide merge: what it refuses", () => {
  for (const { name, view, reason } of REFUSED_PULL_REQUESTS) {
    it(`refuses ${name} without merging anything`, () => {
      const scenario = {
        view: { ...OPEN_WORK_BRANCH, ...view },
        pull: { number: 12 },
      };
      const result = runMerge(createCheckout(SSH_ORIGIN), scenario);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /^style-guide merge: #12 /);
      assert.match(result.stderr, reason);
      assert.deepEqual(result.calls, [VERSION_CALL, VIEW_CALL, PULL_CALL]);
    });
  }

  it("refuses when it cannot tell the repository, without calling gh or printing the remote", () => {
    const remote = "https://user:not-a-real-secret@example.com/acme/web.git";
    for (const directory of [createCheckout(null), createCheckout(remote)]) {
      const result = runMerge(directory, PLAIN);
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /^style-guide merge: cannot tell which repository to act on/,
      );
      assert.doesNotMatch(result.stderr, /not-a-real-secret/);
      assert.deepEqual(result.calls, []);
    }
  });

  it("refuses a GITHUB_REPOSITORY that is not owner/repository", () => {
    const result = runMerge(createCheckout(SSH_ORIGIN), PLAIN, {
      env: { GITHUB_REPOSITORY: "acme" },
    });
    assert.equal(result.status, 1);
    assert.deepEqual(result.calls, []);
  });
});

describe("style-guide merge: how it is called", () => {
  for (const cliArguments of UNUSABLE_ARGUMENTS) {
    it(`exits 2 without calling gh for the arguments ${JSON.stringify(cliArguments)}`, () => {
      const result = runMerge(createCheckout(SSH_ORIGIN), PLAIN, {
        cliArguments,
      });
      assert.equal(result.status, 2);
      assert.match(
        result.stderr,
        /^style-guide: merge takes one pull request number and nothing else/,
      );
      assert.deepEqual(result.calls, []);
    });
  }

  it("exits 1 when gh does not run", () => {
    const scenario = { ...PLAIN, versionFails: true };
    const result = runMerge(createCheckout(SSH_ORIGIN), scenario);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^style-guide merge: the gh CLI did not run/);
    assert.deepEqual(result.calls, [VERSION_CALL]);
  });
});
