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
const FIRST_LAYER = "4444444444444444444444444444444444444444";
const SECOND_LAYER = "5555555555555555555555555555555555555555";
const ZERO = "0000000000000000000000000000000000000000";
const TOKEN = "test-token-not-a-credential";
const COMMIT_PATH = `/repos/acme/web/commits/${AFTER}`;
const PULLS_PATH = `${COMMIT_PATH}/pulls?per_page=100`;
const SEVERAL_COMMITS =
  `style-guide check-landed-commit: develop moved from ${BEFORE} to ${AFTER} ` +
  "by more than one first-parent commit";
const WHAT_HAPPENS_NEXT =
  "What happens next: the push is reverted before the next release, " +
  "or the repository's owner checks its content and accepts it.";

/** @param {string} sha */
function pullsPathOf(sha) {
  return `/repos/acme/web/commits/${sha}/pulls?per_page=100`;
}

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
];

// Three layers of a stack squashed onto develop by one push: each commit is the merge commit of its own pull request.
const STACK_LANDED_AT_ONCE = pushEvent({
  commits: [
    {
      id: FIRST_LAYER,
      message: "feat: add the login form (#11)\n\nThe form posts to /login.",
    },
    { id: SECOND_LAYER, message: "feat: validate the login form (#12)" },
    { id: AFTER, message: "feat: remember the last login (#13)" },
  ],
});
const STACK_RESPONSES = {
  [COMMIT_PATH]: { body: commitWith([SECOND_LAYER]) },
  [PULLS_PATH]: {
    body: [mergedPull({ number: 13, head: { ref: "feat/remember" } })],
  },
  [pullsPathOf(FIRST_LAYER)]: {
    body: [mergedPull({ number: 11, merge_commit_sha: FIRST_LAYER })],
  },
  [pullsPathOf(SECOND_LAYER)]: {
    body: [
      mergedPull({
        number: 12,
        head: { ref: "feat/validate" },
        merge_commit_sha: SECOND_LAYER,
      }),
    ],
  },
};

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

  it("passes without reading the commits the event lists", async () => {
    const result = await runCheck(pushEvent({ commits: "not a list" }), {
      [COMMIT_PATH]: { body: commitWith([BEFORE]) },
      [PULLS_PATH]: { body: [mergedPull({})] },
    });
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
    assert.equal(result.requests.length, 2);
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
      assert.doesNotMatch(result.stderr.trimEnd(), /\n/);
      assert.equal(result.requests.length, 2);
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

describe("style-guide check-landed-commit: a push that moved the branch by several commits", () => {
  it("fails, naming each commit with its merged pull request and what happens next", async () => {
    const result = await runCheck(STACK_LANDED_AT_ONCE, STACK_RESPONSES);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      [
        SEVERAL_COMMITS,
        "The push event lists 3 commit(s):",
        "  4444444 pull request #11: feat: add the login form (#11)",
        "  5555555 pull request #12: feat: validate the login form (#12)",
        "  2222222 pull request #13: feat: remember the last login (#13)",
        WHAT_HAPPENS_NEXT,
        "",
      ].join("\n"),
    );
  });

  it("asks for the pull requests of each listed commit once, the tip included", async () => {
    const { requests } = await runCheck(STACK_LANDED_AT_ONCE, STACK_RESPONSES);
    assert.deepEqual(
      requests.map(({ method, path }) => `${method} ${path}`),
      [
        `GET ${COMMIT_PATH}`,
        `GET ${PULLS_PATH}`,
        `GET ${pullsPathOf(FIRST_LAYER)}`,
        `GET ${pullsPathOf(SECOND_LAYER)}`,
      ],
    );
  });

  it("says which commits are not the merge commit of a merged pull request", async () => {
    const event = pushEvent({
      commits: [
        { id: FIRST_LAYER, message: "wip" },
        { id: AFTER, message: "fix a typo\r\n\r\nSeen in review." },
      ],
    });
    const result = await runCheck(event, {
      [COMMIT_PATH]: { body: commitWith([FIRST_LAYER]) },
      [PULLS_PATH]: { body: [] },
      [pullsPathOf(FIRST_LAYER)]: {
        body: [mergedPull({ merge_commit_sha: null, merged_at: null })],
      },
    });
    assert.equal(result.status, 1);
    assert.equal(
      result.stderr,
      [
        SEVERAL_COMMITS,
        "The push event lists 2 commit(s):",
        "  4444444 no merged pull request: wip",
        "  2222222 no merged pull request: fix a typo",
        WHAT_HAPPENS_NEXT,
        "",
      ].join("\n"),
    );
  });
});

describe("style-guide check-landed-commit: the subject it prints for a commit", () => {
  it("prints the first line without control characters and cuts it at 100 characters", async () => {
    const [escapeCharacter, tab, bell] = [0x1b, 0x09, 0x07].map((code) =>
      String.fromCharCode(code),
    );
    const colored = `fix: ${escapeCharacter}[31mred${escapeCharacter}[0m${tab}and${bell} more`;
    const event = pushEvent({
      commits: [
        { id: FIRST_LAYER, message: `${colored}\n\nSeen in review.` },
        { id: AFTER, message: "x".repeat(163) },
      ],
    });
    const result = await runCheck(event, {
      [COMMIT_PATH]: { body: commitWith([FIRST_LAYER]) },
      [PULLS_PATH]: { body: [] },
      [pullsPathOf(FIRST_LAYER)]: { body: [] },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      [
        SEVERAL_COMMITS,
        "The push event lists 2 commit(s):",
        "  4444444 no merged pull request: fix: [31mred[0mand more",
        `  2222222 no merged pull request: ${"x".repeat(100)} [subject cut at 100 of 163 characters]`,
        WHAT_HAPPENS_NEXT,
        "",
      ].join("\n"),
    );
  });
});

describe("style-guide check-landed-commit: the commits of a push that it does not name", () => {
  it("lists the first 20 commits and asks for the pull requests of those only", async () => {
    const earlier = Array.from({ length: 22 }, (_, index) =>
      (index + 0xa0).toString(16).repeat(20),
    );
    const shas = [...earlier, AFTER];
    const commits = shas.map((id, index) => ({
      id,
      message: `chore: step ${index + 1}`,
    }));
    const responses = {
      [COMMIT_PATH]: { body: commitWith([DEVELOP_TIP]) },
      [PULLS_PATH]: { body: [] },
    };
    for (const sha of shas) responses[pullsPathOf(sha)] = { body: [] };
    const result = await runCheck(pushEvent({ commits }), responses);
    assert.equal(result.status, 1);
    const lines = result.stderr.trimEnd().split("\n");
    assert.equal(lines.length, 24);
    assert.equal(lines[1], "The push event lists 23 commit(s):");
    assert.equal(lines[2], "  a0a0a0a no merged pull request: chore: step 1");
    assert.equal(lines[21], "  b3b3b3b no merged pull request: chore: step 20");
    assert.equal(lines[22], "  ... and 3 more");
    assert.equal(lines[23], WHAT_HAPPENS_NEXT);
    assert.equal(result.requests.length, 22);
  });

  it("keeps the failure and what happens next when the event does not list the commits", async () => {
    const result = await runCheck(pushEvent({}), {
      [COMMIT_PATH]: { body: commitWith([DEVELOP_TIP]) },
      [PULLS_PATH]: { body: [mergedPull({})] },
    });
    assert.equal(result.status, 1);
    assert.equal(
      result.stderr,
      [
        SEVERAL_COMMITS,
        "The commits the push carried could not be listed: the push event's 'commits' is not an array",
        WHAT_HAPPENS_NEXT,
        "",
      ].join("\n"),
    );
  });

  it("keeps the failure and what happens next when GitHub refuses a pull request lookup", async () => {
    const result = await runCheck(STACK_LANDED_AT_ONCE, {
      ...STACK_RESPONSES,
      [pullsPathOf(SECOND_LAYER)]: {
        status: 502,
        body: { message: "Server Error" },
      },
    });
    assert.equal(result.status, 1);
    const lines = result.stderr.trimEnd().split("\n");
    assert.equal(lines.length, 3);
    assert.equal(lines[0], SEVERAL_COMMITS);
    assert.match(
      lines[1],
      /^The commits the push carried could not be listed: GET \S+: HTTP 502$/,
    );
    assert.equal(lines[2], WHAT_HAPPENS_NEXT);
    assert.doesNotMatch(result.stderr, new RegExp(TOKEN));
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
