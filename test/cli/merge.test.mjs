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
  });

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
