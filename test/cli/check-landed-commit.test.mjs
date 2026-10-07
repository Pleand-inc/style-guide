// Runs `style-guide check-landed-commit` against a local HTTP server that answers like the GitHub REST API, so the
// test covers the requests the command makes and what it concludes from the responses.

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  createRepository,
  createTemporaryDirectory,
  runCliWithoutBlocking,
} from "./helpers.mjs";

const BEFORE = "1111111111111111111111111111111111111111";
const AFTER = "2222222222222222222222222222222222222222";
const DEVELOP_TIP = "3333333333333333333333333333333333333333";
const ZERO = "0000000000000000000000000000000000000000";
const TOKEN = "test-token-not-a-credential";
const COMMIT_PATH = `/repos/acme/web/commits/${AFTER}`;
const PULLS_PATH = `${COMMIT_PATH}/pulls?per_page=100`;

/** @param {Record<string, { status?: number, body: unknown }>} responseByPath */
async function startGitHub(responseByPath) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization,
    });
    const answer = responseByPath[request.url] ?? {
      status: 404,
      body: { message: "Not Found" },
    };
    response.writeHead(answer.status ?? 200, {
      "content-type": "application/json",
    });
    response.end(JSON.stringify(answer.body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, requests, url: `http://127.0.0.1:${server.address().port}` };
}

function pushEvent(overrides) {
  return {
    ref: "refs/heads/develop",
    before: BEFORE,
    after: AFTER,
    forced: false,
    deleted: false,
    ...overrides,
  };
}

function mergedPull(overrides) {
  return {
    number: 7,
    base: { ref: "develop" },
    head: { ref: "feat/login" },
    merge_commit_sha: AFTER,
    merged_at: "2026-01-02T03:04:05Z",
    ...overrides,
  };
}

function commitWith(parents) {
  return { sha: AFTER, parents: parents.map((sha) => ({ sha })) };
}

/**
 * @param {object} event the push event GitHub would write to GITHUB_EVENT_PATH
 * @param {Record<string, { status?: number, body: unknown }>} responseByPath
 * @param {{ env?: Record<string, string>, config?: object }} options
 */
async function runCheck(event, responseByPath, options = {}) {
  const directory = createRepository("develop");
  if (options.config)
    writeFileSync(
      join(directory, "style-guide.config.json"),
      JSON.stringify(options.config),
    );
  const eventPath = join(
    createTemporaryDirectory("style-guide-event-"),
    "event.json",
  );
  writeFileSync(eventPath, JSON.stringify(event));
  const gitHub = await startGitHub(responseByPath);
  try {
    const result = await runCliWithoutBlocking(["check-landed-commit"], {
      cwd: directory,
      env: {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: "acme/web",
        GITHUB_TOKEN: TOKEN,
        GITHUB_API_URL: gitHub.url,
        ...options.env,
      },
    });
    return { ...result, requests: gitHub.requests };
  } finally {
    gitHub.server.closeAllConnections();
    await new Promise((resolve) => gitHub.server.close(resolve));
  }
}

const PUSHES_OUTSIDE_THE_FLOW = [
  {
    name: "a commit pushed onto develop with no pull request",
    event: pushEvent({}),
    commit: commitWith([BEFORE]),
    pulls: [],
    reason: /did not come from a merged pull request/,
  },
  {
    name: "a squash of develop onto master",
    event: pushEvent({ ref: "refs/heads/master" }),
    commit: commitWith([BEFORE]),
    pulls: [mergedPull({ base: { ref: "master" }, head: { ref: "develop" } })],
    reason:
      /#7 landed on master as a commit with 1 parent\(s\): master takes merge commits/,
  },
  {
    name: "a work branch merged into master",
    event: pushEvent({ ref: "refs/heads/master" }),
    commit: commitWith([BEFORE, DEVELOP_TIP]),
    pulls: [mergedPull({ base: { ref: "master" } })],
    reason: /#7: 'feat\/login' targets master: master takes only develop/,
  },
  {
    name: "a merge commit on develop",
    event: pushEvent({}),
    commit: commitWith([BEFORE, DEVELOP_TIP]),
    pulls: [mergedPull({})],
    reason: /develop takes squash commits/,
  },
  {
    name: "a force push",
    event: pushEvent({ forced: true }),
    commit: commitWith([BEFORE]),
    pulls: [mergedPull({})],
    reason: /develop was force-pushed/,
  },
  {
    name: "the creation of the branch",
    event: pushEvent({ before: ZERO }),
    commit: commitWith([BEFORE]),
    pulls: [mergedPull({})],
    reason: /develop was created/,
  },
  {
    name: "a push that moved the branch by two commits",
    event: pushEvent({}),
    commit: commitWith([DEVELOP_TIP]),
    pulls: [mergedPull({})],
    reason: /by more than one first-parent commit/,
  },
];

describe("style-guide check-landed-commit: pushes that follow the flow", () => {
  it("passes a squash merge of a work branch on develop, asking for the commit and its pull requests", async () => {
    const result = await runCheck(pushEvent({}), {
      [COMMIT_PATH]: { body: commitWith([BEFORE]) },
      [PULLS_PATH]: { body: [mergedPull({})] },
    });
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout,
      `style-guide check-landed-commit: ${AFTER} landed on develop through a pull request\n`,
    );
    assert.deepEqual(result.requests, [
      { method: "GET", path: COMMIT_PATH, authorization: `Bearer ${TOKEN}` },
      { method: "GET", path: PULLS_PATH, authorization: `Bearer ${TOKEN}` },
    ]);
  });

  it("passes a merge commit of develop on master", async () => {
    const result = await runCheck(pushEvent({ ref: "refs/heads/master" }), {
      [COMMIT_PATH]: { body: commitWith([BEFORE, DEVELOP_TIP]) },
      [PULLS_PATH]: {
        body: [
          mergedPull({ base: { ref: "master" }, head: { ref: "develop" } }),
        ],
      },
    });
    assert.equal(result.status, 0);
  });

  it("follows style-guide.config.json for the head of the merged pull request", async () => {
    const responses = {
      [COMMIT_PATH]: { body: commitWith([BEFORE]) },
      [PULLS_PATH]: { body: [mergedPull({ head: { ref: "ops/deploy" } })] },
    };
    assert.equal((await runCheck(pushEvent({}), responses)).status, 1);
    const config = { branchFlow: { workBranchPrefixes: ["feat", "ops"] } };
    assert.equal(
      (await runCheck(pushEvent({}), responses, { config })).status,
      0,
    );
  });
});

describe("style-guide check-landed-commit: pushes outside the flow", () => {
  for (const {
    name,
    event,
    commit,
    pulls,
    reason,
  } of PUSHES_OUTSIDE_THE_FLOW) {
    it(`fails ${name}`, async () => {
      const result = await runCheck(event, {
        [COMMIT_PATH]: { body: commit },
        [PULLS_PATH]: { body: pulls },
      });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /^style-guide check-landed-commit: /);
      assert.match(result.stderr, reason);
    });
  }

  it("fails a deleted branch without asking GitHub anything", async () => {
    const result = await runCheck(
      pushEvent({ after: ZERO, deleted: true }),
      {},
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /develop was deleted/);
    assert.deepEqual(result.requests, []);
  });

  it("fails an event for another branch", async () => {
    const result = await runCheck(
      pushEvent({ ref: "refs/heads/feat/login" }),
      {},
    );
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /this check runs on pushes to master and develop only/,
    );
    assert.deepEqual(result.requests, []);
  });
});

describe("style-guide check-landed-commit: what it cannot establish", () => {
  it("fails when GitHub refuses the request, naming the status and not the token", async () => {
    const result = await runCheck(pushEvent({}), {
      [COMMIT_PATH]: {
        status: 403,
        body: { message: "Resource not accessible by integration" },
      },
    });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /^style-guide check-landed-commit: GET \S+: HTTP 403\n$/,
    );
    assert.doesNotMatch(result.stderr + result.stdout, new RegExp(TOKEN));
  });

  it("fails when a response is not what the API documents", async () => {
    const result = await runCheck(pushEvent({}), {
      [COMMIT_PATH]: { body: commitWith([BEFORE]) },
      [PULLS_PATH]: { body: { message: "unexpected" } },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /the pull requests response is not an array/);
  });

  for (const name of [
    "GITHUB_EVENT_PATH",
    "GITHUB_REPOSITORY",
    "GITHUB_TOKEN",
  ]) {
    it(`exits 2 when ${name} is not set`, async () => {
      const result = await runCheck(pushEvent({}), {}, { env: { [name]: "" } });
      assert.equal(result.status, 2);
      assert.equal(
        result.stderr,
        `style-guide: check-landed-commit needs ${name} in the environment\n`,
      );
      assert.deepEqual(result.requests, []);
    });
  }
});
