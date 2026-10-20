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
const REBASED_FIRST = "6666666666666666666666666666666666666666";
const REBASED_SECOND = "7777777777777777777777777777777777777777";
const PUSHED_DIRECTLY = "8888888888888888888888888888888888888888";
const PULL_HEAD = "9999999999999999999999999999999999999999";
const ZERO = "0000000000000000000000000000000000000000";
const TOKEN = "test-token-not-a-credential";
const COMMIT_PATH = `/repos/acme/web/commits/${AFTER}`;
const PULLS_PATH = `${COMMIT_PATH}/pulls?per_page=100`;
const PULL_PATH = "/repos/acme/web/pulls/7";
const PULL_COMMITS_PATH = `${PULL_PATH}/commits?per_page=100`;
const AUTHOR = { name: "A. Author", email: "author@example.com" };
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

/** @param {string} sha */
function commitPathOf(sha) {
  return `/repos/acme/web/commits/${sha}`;
}

/** @param {number} number */
function pullPathOf(number) {
  return `/repos/acme/web/pulls/${number}`;
}

/** @param {number} number */
function pullCommitsPathOf(number) {
  return `${pullPathOf(number)}/commits?per_page=100`;
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
  return commitOf(AFTER, parents);
}

function commitOf(sha, parents) {
  return { sha, parents: parents.map((parent) => ({ sha: parent })) };
}

// A commit a rebase merge wrote: GitHub is its committer, and it keeps the message and author of the original.
function rebasedCommit(sha, parents, message) {
  const committer = { name: "GitHub", email: "noreply@github.com" };
  return {
    ...commitOf(sha, parents),
    commit: { message, author: AUTHOR, committer },
  };
}

// A commit of the pull request as `GET /repos/{owner}/{repo}/pulls/{number}/commits` lists it.
function pullCommit(message, index) {
  const sha = (index + 1).toString(16).padStart(40, "a");
  return { sha, commit: { message, author: AUTHOR, committer: AUTHOR } };
}

// The response for one pull request, which alone says how many commits the pull request has.
function pullWithCommits(commits, overrides) {
  const pull = mergedPull(overrides);
  return {
    ...pull,
    head: { sha: PULL_HEAD, ...pull.head },
    merged: true,
    commits,
  };
}

/** @param {string[]} lines the lines between the reason and what happens next */
function severalCommitsFailure(lines) {
  return [SEVERAL_COMMITS, ...lines, WHAT_HAPPENS_NEXT, ""].join("\n");
}

function requestLines(requests) {
  return requests.map(({ method, path }) => `${method} ${path}`);
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
    reason:
      /#7 landed on develop as a commit with 2 parent\(s\): develop takes squash commits or rebased commits\n$/,
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
  // The tip is the merge commit of #13, so the check asks whether the push is #13 rebased; #13 had one commit.
  [pullPathOf(13)]: {
    body: pullWithCommits(1, { number: 13, head: { ref: "feat/remember" } }),
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
        `GET ${pullPathOf(13)}`,
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

// Pull request #7 had three commits. A rebase merge put them onto develop as REBASED_FIRST, REBASED_SECOND and AFTER,
// one parent each and with the message and author of each, and GitHub records AFTER, the commit develop moved to, as
// the pull request's merge_commit_sha. PULL_HEAD was the last commit of the pull request's branch.
const REBASED_MESSAGES = [
  "feat: add the login form",
  "feat: validate the login form",
  "feat: remember the last login",
];
const REBASE_PUSH = pushEvent({
  commits: [
    { id: REBASED_FIRST, message: REBASED_MESSAGES[0] },
    { id: REBASED_SECOND, message: REBASED_MESSAGES[1] },
    { id: AFTER, message: REBASED_MESSAGES[2] },
  ],
});
const REBASE_RESPONSES = {
  [COMMIT_PATH]: {
    body: rebasedCommit(AFTER, [REBASED_SECOND], REBASED_MESSAGES[2]),
  },
  [PULLS_PATH]: { body: [mergedPull({})] },
  [PULL_PATH]: { body: pullWithCommits(3) },
  [PULL_COMMITS_PATH]: { body: REBASED_MESSAGES.map(pullCommit) },
  [commitPathOf(REBASED_SECOND)]: {
    body: rebasedCommit(REBASED_SECOND, [REBASED_FIRST], REBASED_MESSAGES[1]),
  },
  [commitPathOf(REBASED_FIRST)]: {
    body: rebasedCommit(REBASED_FIRST, [BEFORE], REBASED_MESSAGES[0]),
  },
  // Asked only to list the commits of a push that fails.
  [pullsPathOf(REBASED_SECOND)]: { body: [mergedPull({})] },
  [pullsPathOf(REBASED_FIRST)]: { body: [mergedPull({})] },
};
const REBASE_WALK_REQUESTS = [
  `GET ${COMMIT_PATH}`,
  `GET ${PULLS_PATH}`,
  `GET ${PULL_PATH}`,
  `GET ${PULL_COMMITS_PATH}`,
  `GET ${commitPathOf(REBASED_SECOND)}`,
  `GET ${commitPathOf(REBASED_FIRST)}`,
];
const REBASE_PUSH_LINES = [
  "The push event lists 3 commit(s):",
  "  6666666 no merged pull request: feat: add the login form",
  "  7777777 no merged pull request: feat: validate the login form",
  "  2222222 pull request #7: feat: remember the last login",
];
const REBASE_PUSH_LISTING_REQUESTS = [
  `GET ${pullsPathOf(REBASED_FIRST)}`,
  `GET ${pullsPathOf(REBASED_SECOND)}`,
];

describe("style-guide check-landed-commit: a rebase merge on develop", () => {
  it("passes the commits of one merged pull request rebased onto develop, reading the pull request, its commits and the walk", async () => {
    const result = await runCheck(REBASE_PUSH, REBASE_RESPONSES);
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
    assert.equal(
      result.stdout,
      `style-guide check-landed-commit: ${AFTER} landed on develop through a pull request\n`,
    );
    assert.deepEqual(requestLines(result.requests), REBASE_WALK_REQUESTS);
  });

  it("passes when the pull request response names no stack", async () => {
    const result = await runCheck(REBASE_PUSH, {
      ...REBASE_RESPONSES,
      [PULL_PATH]: { body: pullWithCommits(3, { stack: null }) },
    });
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
    assert.deepEqual(requestLines(result.requests), REBASE_WALK_REQUESTS);
  });

  it("still passes a squash merge without asking for the pull request", async () => {
    const result = await runCheck(pushEvent({}), {
      [COMMIT_PATH]: { body: commitWith([BEFORE]) },
      [PULLS_PATH]: { body: [mergedPull({})] },
      [PULL_PATH]: { body: pullWithCommits(3) },
    });
    assert.equal(result.status, 0);
    assert.deepEqual(requestLines(result.requests), [
      `GET ${COMMIT_PATH}`,
      `GET ${PULLS_PATH}`,
    ]);
  });
});

describe("style-guide check-landed-commit: a push of several commits that is not one pull request rebased", () => {
  it("fails when the walk does not reach before: the pull request's commits sit on a commit pushed with them", async () => {
    const event = pushEvent({
      commits: [
        { id: PUSHED_DIRECTLY, message: "fix: a typo" },
        ...REBASE_PUSH.commits,
      ],
    });
    const result = await runCheck(event, {
      ...REBASE_RESPONSES,
      [commitPathOf(REBASED_FIRST)]: {
        body: rebasedCommit(
          REBASED_FIRST,
          [PUSHED_DIRECTLY],
          REBASED_MESSAGES[0],
        ),
      },
      [pullsPathOf(PUSHED_DIRECTLY)]: { body: [] },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      severalCommitsFailure([
        "The push event lists 4 commit(s):",
        "  8888888 no merged pull request: fix: a typo",
        ...REBASE_PUSH_LINES.slice(1),
      ]),
    );
    // The walk stops at the pull request's commit count; the lines above come from the pull requests of each commit.
    assert.deepEqual(requestLines(result.requests), [
      ...REBASE_WALK_REQUESTS,
      `GET ${pullsPathOf(PUSHED_DIRECTLY)}`,
      ...REBASE_PUSH_LISTING_REQUESTS,
    ]);
  });

  it("fails when the walk meets a commit with two parents, and walks no further", async () => {
    const result = await runCheck(REBASE_PUSH, {
      ...REBASE_RESPONSES,
      [commitPathOf(REBASED_SECOND)]: {
        body: rebasedCommit(
          REBASED_SECOND,
          [REBASED_FIRST, DEVELOP_TIP],
          REBASED_MESSAGES[1],
        ),
      },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, severalCommitsFailure(REBASE_PUSH_LINES));
    assert.deepEqual(requestLines(result.requests), [
      ...REBASE_WALK_REQUESTS.slice(0, 5),
      ...REBASE_PUSH_LISTING_REQUESTS,
    ]);
  });

  for (const commits of [2, 4]) {
    it(`fails when the pull request has ${commits} commits and the walk reaches before in 3`, async () => {
      const result = await runCheck(REBASE_PUSH, {
        ...REBASE_RESPONSES,
        [PULL_PATH]: { body: pullWithCommits(commits) },
      });
      assert.equal(result.status, 1);
      assert.equal(result.stderr, severalCommitsFailure(REBASE_PUSH_LINES));
    });
  }

  it("fails a pull request with no commits as before, without listing its commits", async () => {
    const result = await runCheck(REBASE_PUSH, {
      ...REBASE_RESPONSES,
      [PULL_PATH]: { body: pullWithCommits(0) },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, severalCommitsFailure(REBASE_PUSH_LINES));
    assert.deepEqual(requestLines(result.requests), [
      ...REBASE_WALK_REQUESTS.slice(0, 3),
      ...REBASE_PUSH_LISTING_REQUESTS,
    ]);
  });

  it("fails the pull request's own commits pushed onto develop: the tip of a rebase merge is never the pull request's head", async () => {
    const result = await runCheck(REBASE_PUSH, {
      ...REBASE_RESPONSES,
      [PULL_PATH]: {
        body: pullWithCommits(3, { head: { ref: "feat/login", sha: AFTER } }),
      },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, severalCommitsFailure(REBASE_PUSH_LINES));
    assert.deepEqual(requestLines(result.requests), [
      ...REBASE_WALK_REQUESTS.slice(0, 3),
      ...REBASE_PUSH_LISTING_REQUESTS,
    ]);
  });

  it("fails a pull request in a GitHub stack as before, without listing its commits, even when the push meets every other condition", async () => {
    // What "Merge stack" with the rebase method might leave: the top pull request's merge_commit_sha at the tip, the
    // layers' commits below it, and a pull request response that still names the stack.
    const stack = {
      id: 3,
      number: 1,
      size: 2,
      position: 2,
      base: { ref: "develop", sha: BEFORE },
    };
    const result = await runCheck(REBASE_PUSH, {
      ...REBASE_RESPONSES,
      [PULL_PATH]: { body: pullWithCommits(3, { stack }) },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, severalCommitsFailure(REBASE_PUSH_LINES));
    assert.deepEqual(requestLines(result.requests), [
      ...REBASE_WALK_REQUESTS.slice(0, 3),
      ...REBASE_PUSH_LISTING_REQUESTS,
    ]);
  });

  it("fails a pull request of more than 100 commits without walking it, and says why", async () => {
    const result = await runCheck(REBASE_PUSH, {
      ...REBASE_RESPONSES,
      [PULL_PATH]: { body: pullWithCommits(101) },
    });
    assert.equal(result.status, 1);
    assert.equal(
      result.stderr,
      severalCommitsFailure([
        ...REBASE_PUSH_LINES,
        "Whether the push is the rebase merge of #7 was not checked: #7 has 101 commits, " +
          "and a pull request with more than 100 commits is squashed, not rebased",
      ]),
    );
    assert.deepEqual(requestLines(result.requests), [
      ...REBASE_WALK_REQUESTS.slice(0, 3),
      ...REBASE_PUSH_LISTING_REQUESTS,
    ]);
  });

  it("fails a stack landed at once when the top pull request has as many commits as the push", async () => {
    const result = await runCheck(STACK_LANDED_AT_ONCE, {
      ...STACK_RESPONSES,
      [COMMIT_PATH]: {
        body: rebasedCommit(
          AFTER,
          [SECOND_LAYER],
          "feat: remember the last login (#13)",
        ),
      },
      [pullPathOf(13)]: {
        body: pullWithCommits(3, {
          number: 13,
          head: { ref: "feat/remember" },
        }),
      },
      [pullCommitsPathOf(13)]: {
        body: [
          "feat: store the last login",
          "feat: read the last login",
          "feat: remember the last login",
        ].map(pullCommit),
      },
    });
    assert.equal(result.status, 1);
    assert.equal(
      result.stderr,
      severalCommitsFailure([
        "The push event lists 3 commit(s):",
        "  4444444 pull request #11: feat: add the login form (#11)",
        "  5555555 pull request #12: feat: validate the login form (#12)",
        "  2222222 pull request #13: feat: remember the last login (#13)",
      ]),
    );
    // The tip carries the squash title of #13, not the message of its last commit, so the walk reads nothing below it.
    assert.deepEqual(requestLines(result.requests), [
      `GET ${COMMIT_PATH}`,
      `GET ${PULLS_PATH}`,
      `GET ${pullPathOf(13)}`,
      `GET ${pullCommitsPathOf(13)}`,
      `GET ${pullsPathOf(FIRST_LAYER)}`,
      `GET ${pullsPathOf(SECOND_LAYER)}`,
    ]);
  });

  it("fails a stack landed at once even when the top layer's squash commit has its pull request's last message", async () => {
    const event = pushEvent({
      commits: [
        ...STACK_LANDED_AT_ONCE.commits.slice(0, 2),
        { id: AFTER, message: "feat: remember the last login" },
      ],
    });
    const result = await runCheck(event, {
      ...STACK_RESPONSES,
      [COMMIT_PATH]: {
        body: rebasedCommit(
          AFTER,
          [SECOND_LAYER],
          "feat: remember the last login",
        ),
      },
      [pullPathOf(13)]: {
        body: pullWithCommits(3, {
          number: 13,
          head: { ref: "feat/remember" },
        }),
      },
      [pullCommitsPathOf(13)]: {
        body: [
          "feat: store the last login",
          "feat: read the last login",
          "feat: remember the last login",
        ].map(pullCommit),
      },
      [commitPathOf(SECOND_LAYER)]: {
        body: rebasedCommit(
          SECOND_LAYER,
          [FIRST_LAYER],
          "feat: validate the login form (#12)",
        ),
      },
      [commitPathOf(FIRST_LAYER)]: {
        body: rebasedCommit(
          FIRST_LAYER,
          [BEFORE],
          "feat: add the login form (#11)\n\nThe form posts to /login.",
        ),
      },
    });
    assert.equal(result.status, 1);
    assert.equal(
      result.stderr,
      severalCommitsFailure([
        "The push event lists 3 commit(s):",
        "  4444444 pull request #11: feat: add the login form (#11)",
        "  5555555 pull request #12: feat: validate the login form (#12)",
        "  2222222 pull request #13: feat: remember the last login",
      ]),
    );
    // The walk stops at the squash commit of #12 and never reads the commit below it.
    assert.deepEqual(requestLines(result.requests), [
      `GET ${COMMIT_PATH}`,
      `GET ${PULLS_PATH}`,
      `GET ${pullPathOf(13)}`,
      `GET ${pullCommitsPathOf(13)}`,
      `GET ${commitPathOf(SECOND_LAYER)}`,
      `GET ${pullsPathOf(FIRST_LAYER)}`,
      `GET ${pullsPathOf(SECOND_LAYER)}`,
    ]);
  });

  it("fails a push of several commits whose tip no pull request merged, as before and without asking for a pull request", async () => {
    const event = pushEvent({
      commits: [
        { id: FIRST_LAYER, message: "wip" },
        { id: AFTER, message: "fix a typo" },
      ],
    });
    const result = await runCheck(event, {
      [COMMIT_PATH]: { body: commitWith([FIRST_LAYER]) },
      [PULLS_PATH]: { body: [] },
      [pullsPathOf(FIRST_LAYER)]: { body: [] },
    });
    assert.equal(result.status, 1);
    assert.equal(
      result.stderr,
      severalCommitsFailure([
        "The push event lists 2 commit(s):",
        "  4444444 no merged pull request: wip",
        "  2222222 no merged pull request: fix a typo",
      ]),
    );
    assert.deepEqual(requestLines(result.requests), [
      `GET ${COMMIT_PATH}`,
      `GET ${PULLS_PATH}`,
      `GET ${pullsPathOf(FIRST_LAYER)}`,
    ]);
  });

  it("keeps master to one first-parent commit per push, even for a push that meets every condition of a rebase merge into develop", async () => {
    const event = { ...REBASE_PUSH, ref: "refs/heads/master" };
    const result = await runCheck(event, REBASE_RESPONSES);
    assert.equal(result.status, 1);
    assert.equal(
      result.stderr,
      [
        `style-guide check-landed-commit: master moved from ${BEFORE} to ${AFTER} by more than one first-parent commit`,
        ...REBASE_PUSH_LINES,
        WHAT_HAPPENS_NEXT,
        "",
      ].join("\n"),
    );
    assert.deepEqual(requestLines(result.requests), [
      `GET ${COMMIT_PATH}`,
      `GET ${PULLS_PATH}`,
      ...REBASE_PUSH_LISTING_REQUESTS,
    ]);
  });
});

describe("style-guide check-landed-commit: a push that may be a rebase merge when GitHub's answers fall short", () => {
  const uncheckedLine = (reason) =>
    new RegExp(
      `^Whether the push is the rebase merge of #7 could not be checked: ${reason}$`,
    );

  /**
   * @param {{ stderr: string }} result
   * @param {RegExp} line the line between the commits and what happens next
   */
  function assertFailsAsBeforeWith(result, line) {
    const lines = result.stderr.split("\n");
    assert.deepEqual(lines.slice(0, 5), [
      SEVERAL_COMMITS,
      ...REBASE_PUSH_LINES,
    ]);
    assert.match(lines[5], line);
    assert.deepEqual(lines.slice(6), [WHAT_HAPPENS_NEXT, ""]);
    assert.doesNotMatch(result.stderr, new RegExp(TOKEN));
  }

  for (const status of [502, 403]) {
    it(`keeps the failure and the commits when GitHub answers HTTP ${status} for the pull request, and says why`, async () => {
      const result = await runCheck(REBASE_PUSH, {
        ...REBASE_RESPONSES,
        [PULL_PATH]: {
          status,
          body: { message: "API rate limit exceeded for installation." },
        },
      });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assertFailsAsBeforeWith(
        result,
        uncheckedLine(
          `GET http://127\\.0\\.0\\.1:\\d+${PULL_PATH}: HTTP ${status}`,
        ),
      );
      assert.deepEqual(requestLines(result.requests), [
        ...REBASE_WALK_REQUESTS.slice(0, 3),
        ...REBASE_PUSH_LISTING_REQUESTS,
      ]);
    });
  }

  for (const path of [PULL_COMMITS_PATH, commitPathOf(REBASED_FIRST)]) {
    it(`keeps the failure and the commits when GitHub answers HTTP 502 for ${path}`, async () => {
      const result = await runCheck(REBASE_PUSH, {
        ...REBASE_RESPONSES,
        [path]: { status: 502, body: { message: "Server Error" } },
      });
      assert.equal(result.status, 1);
      const escapedPath = path.replaceAll("?", "\\?");
      assertFailsAsBeforeWith(
        result,
        uncheckedLine(
          `GET http://127\\.0\\.0\\.1:\\d+${escapedPath}: HTTP 502`,
        ),
      );
    });
  }

  it("keeps the failure and the commits when the pull request response does not say how many commits it has", async () => {
    const result = await runCheck(REBASE_PUSH, {
      ...REBASE_RESPONSES,
      [PULL_PATH]: { body: mergedPull({}) },
    });
    assert.equal(result.status, 1);
    assertFailsAsBeforeWith(
      result,
      uncheckedLine(
        "the pull request response has no non-negative integer 'commits'",
      ),
    );
  });

  it("keeps the failure and the commits when the tip's response has no message or author", async () => {
    const result = await runCheck(REBASE_PUSH, {
      ...REBASE_RESPONSES,
      [COMMIT_PATH]: { body: commitWith([REBASED_SECOND]) },
    });
    assert.equal(result.status, 1);
    assertFailsAsBeforeWith(
      result,
      uncheckedLine("the commit response's 'commit' is not an object"),
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
      [PULL_PATH]: { body: pullWithCommits(1) },
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
