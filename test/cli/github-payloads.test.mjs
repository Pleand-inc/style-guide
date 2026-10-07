import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isStackedPullRequest,
  readCommit,
  readPullRequestView,
  readPulls,
  readPushEvent,
} from "../../cli/lib/github-payloads.mjs";

const BEFORE = "1111111111111111111111111111111111111111";
const AFTER = "2222222222222222222222222222222222222222";

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

describe("readPushEvent", () => {
  it("reads the branch and what the push did to it", () => {
    assert.deepEqual(
      readPushEvent(pushEvent({ pusher: { name: "someone" } })),
      {
        branch: "develop",
        before: BEFORE,
        after: AFTER,
        forced: false,
        deleted: false,
      },
    );
    assert.equal(
      readPushEvent(pushEvent({ ref: "refs/heads/master", forced: true }))
        .branch,
      "master",
    );
  });

  for (const ref of [
    "refs/heads/feat/login",
    "refs/tags/master",
    "master",
    "refs/heads/develop/x",
  ]) {
    it(`rejects an event for ${ref}`, () => {
      assert.throws(
        () => readPushEvent(pushEvent({ ref })),
        /runs on pushes to master and develop only/,
      );
    });
  }

  it("rejects a payload that is not a push event", () => {
    assert.throws(() => readPushEvent(null), /the push event is not an object/);
    assert.throws(() => readPushEvent([]), /the push event is not an object/);
    assert.throws(
      () => readPushEvent(pushEvent({ ref: undefined })),
      /no string 'ref'/,
    );
    assert.throws(
      () => readPushEvent(pushEvent({ after: 7 })),
      /no string 'after'/,
    );
    assert.throws(
      () => readPushEvent(pushEvent({ forced: "false" })),
      /no boolean 'forced'/,
    );
  });
});

describe("readCommit", () => {
  it("reads the sha and the parents' shas in order", () => {
    const response = {
      sha: AFTER,
      parents: [{ sha: BEFORE, url: "x" }, { sha: "3333" }],
      commit: { message: "m" },
    };
    assert.deepEqual(readCommit(response), {
      sha: AFTER,
      parents: [BEFORE, "3333"],
    });
    assert.deepEqual(readCommit({ sha: AFTER, parents: [] }), {
      sha: AFTER,
      parents: [],
    });
  });

  it("rejects a response without a sha or without parents", () => {
    assert.throws(() => readCommit({ parents: [] }), /no string 'sha'/);
    assert.throws(
      () => readCommit({ sha: AFTER }),
      /'parents' is not an array/,
    );
    assert.throws(
      () => readCommit({ sha: AFTER, parents: ["x"] }),
      /a parent is not an object/,
    );
    assert.throws(
      () => readCommit({ message: "Not Found" }),
      /'parents' is not an array/,
    );
  });
});

describe("readPulls", () => {
  const merged = {
    number: 7,
    base: { ref: "develop" },
    head: { ref: "feat/login" },
    merge_commit_sha: AFTER,
    merged_at: "2026-01-02T03:04:05Z",
  };

  it("reads the pairing and whether the pull request merged", () => {
    const open = {
      ...merged,
      number: 8,
      merge_commit_sha: null,
      merged_at: null,
    };
    assert.deepEqual(readPulls([merged, open]), [
      {
        number: 7,
        base: "develop",
        head: "feat/login",
        mergeCommitSha: AFTER,
        merged: true,
      },
      {
        number: 8,
        base: "develop",
        head: "feat/login",
        mergeCommitSha: null,
        merged: false,
      },
    ]);
    assert.deepEqual(readPulls([]), []);
  });

  it("rejects a response that is not a list of pull requests", () => {
    assert.throws(
      () => readPulls({ message: "Not Found" }),
      /the pull requests response is not an array/,
    );
    assert.throws(
      () => readPulls([{ ...merged, number: "7" }]),
      /no numeric 'number'/,
    );
    assert.throws(
      () => readPulls([{ ...merged, base: null }]),
      /'base' is not an object/,
    );
    assert.throws(
      () => readPulls([{ ...merged, head: {} }]),
      /'head' has no string 'ref'/,
    );
  });
});

describe("readPullRequestView", () => {
  const view = {
    baseRefName: "develop",
    headRefName: "feat/login",
    state: "OPEN",
    isDraft: false,
    title: "feat: add the login form",
  };

  it("reads the fields gh pr view prints", () => {
    assert.deepEqual(readPullRequestView(view), {
      base: "develop",
      head: "feat/login",
      state: "OPEN",
      isDraft: false,
      title: "feat: add the login form",
    });
  });

  it("rejects output that lacks a field", () => {
    assert.throws(
      () => readPullRequestView({ ...view, isDraft: undefined }),
      /no boolean 'isDraft'/,
    );
    assert.throws(
      () => readPullRequestView({ ...view, baseRefName: undefined }),
      /no string 'baseRefName'/,
    );
    assert.throws(
      () => readPullRequestView("OPEN"),
      /the gh pr view output is not an object/,
    );
  });
});

describe("isStackedPullRequest", () => {
  it("is true only when the pull request carries a stack", () => {
    assert.equal(isStackedPullRequest({ number: 7, stack: { id: 3 } }), true);
    assert.equal(isStackedPullRequest({ number: 7, stack: null }), false);
    assert.equal(isStackedPullRequest({ number: 7 }), false);
  });

  it("rejects a response that is not a pull request", () => {
    assert.throws(
      () => isStackedPullRequest([]),
      /the pull request response is not an object/,
    );
  });
});
