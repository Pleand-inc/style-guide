import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideMerge, isProtectedBranch } from "./branch-flow.mjs";

describe("isProtectedBranch", () => {
  it("is true for master and develop only", () => {
    assert.equal(isProtectedBranch("master"), true);
    assert.equal(isProtectedBranch("develop"), true);
    for (const name of ["main", "develop-x", "feat/master", "", "Master"]) {
      assert.equal(isProtectedBranch(name), false, name);
    }
  });
});

describe("decideMerge", () => {
  for (const head of ["feat/a", "fix/a", "chore/a", "docs/a", "feat/a/b"]) {
    it(`squashes ${head} into develop and deletes the branch`, () => {
      assert.deepEqual(decideMerge({ base: "develop", head }), { method: "squash", deleteBranch: true });
    });
  }

  it("merges develop into master with a merge commit and keeps develop", () => {
    assert.deepEqual(decideMerge({ base: "master", head: "develop" }), { method: "merge", deleteBranch: false });
  });

  const refusals = [
    { base: "master", head: "feat/a" },
    { base: "master", head: "master" },
    { base: "develop", head: "master" },
    { base: "develop", head: "develop" },
    { base: "develop", head: "infra/a" },
    { base: "develop", head: "feature/a" },
    { base: "develop", head: "feat" },
    { base: "develop", head: "feat/" },
    { base: "develop", head: "worktree-x" },
    { base: "feat/a", head: "fix/b" },
    { base: "main", head: "develop" },
    { base: "develop-x", head: "feat/a" },
  ];
  for (const pr of refusals) {
    it(`refuses ${pr.head} -> ${pr.base}`, () => {
      const decision = decideMerge(pr);
      assert.deepEqual(Object.keys(decision), ["refused"]);
      assert.equal(typeof decision.refused, "string");
      assert.doesNotMatch(decision.refused, /\n/);
    });
  }
});
