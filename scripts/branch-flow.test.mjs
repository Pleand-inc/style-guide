import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideMerge, isProtectedBranch, mergeCommands } from "./branch-flow.mjs";

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

describe("mergeCommands", () => {
  const repo = "Pleand-inc/style-guide";
  const work = { number: "14", repo, title: "docs: move the branch flow", headRef: "docs/branch-flow-process" };
  const release = { number: "9", repo, title: "release: rules (0.0.3)", headRef: "develop" };
  const squash = decideMerge({ base: "develop", head: work.headRef });
  const mergeCommit = decideMerge({ base: "master", head: "develop" });

  it("squashes a pull request outside a stack with gh pr merge and deletes the branch", () => {
    assert.deepEqual(mergeCommands({ ...work, inStack: false }, squash), [
      ["pr", "merge", "14", "--repo", repo, "--squash", "--delete-branch"],
    ]);
  });

  it("merges develop into master with the subject '<title> (#<number>)'", () => {
    assert.deepEqual(mergeCommands({ ...release, inStack: false }, mergeCommit), [
      ["pr", "merge", "9", "--repo", repo, "--merge", "--subject", "release: rules (0.0.3) (#9)"],
    ]);
  });

  it("squashes a stacked pull request with gh stack merge, then deletes its head branch", () => {
    assert.deepEqual(mergeCommands({ ...work, inStack: true }, squash), [
      ["stack", "merge", "14", "--squash", "--yes"],
      ["api", "-X", "DELETE", "repos/Pleand-inc/style-guide/git/refs/heads/docs/branch-flow-process"],
    ]);
  });

  it("deletes exactly the head branch of a stacked pull request when its name holds # or %", () => {
    const commands = mergeCommands({ ...work, headRef: "docs/a#b%c", inStack: true }, squash);
    assert.deepEqual(commands[1], [
      "api",
      "-X",
      "DELETE",
      "repos/Pleand-inc/style-guide/git/refs/heads/docs/a%23b%25c",
    ]);
  });

  it("refuses a stacked pull request into master", () => {
    const commands = mergeCommands({ ...release, inStack: true }, mergeCommit);
    assert.deepEqual(Object.keys(commands), ["refused"]);
    assert.equal(typeof commands.refused, "string");
    assert.doesNotMatch(commands.refused, /\n/);
  });
});
