import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyPushTarget,
  commitProblem,
  decideMerge,
  isProtectedBranch,
  isWorkBranch,
  landedCommitProblem,
  mergeCommands,
  planMerge,
  pullRequestPairProblem,
  pushProblems,
} from "../../cli/lib/branch-flow.mjs";
import { DEFAULT_BRANCH_FLOW } from "../../cli/lib/config.mjs";

const SHA = "cb829e2f0c1d4a5b6e7f8091a2b3c4d5e6f70812";
const ZERO = "0000000000000000000000000000000000000000";
const BEFORE = "1111111111111111111111111111111111111111";
const MERGE = "2222222222222222222222222222222222222222";
const DEVELOP_TIP = "3333333333333333333333333333333333333333";

const CUSTOM_BRANCH_FLOW = {
  workBranchPrefixes: ["feat", "fix", "ops"],
  longLivedBranches: ["staging"],
};

describe("isProtectedBranch", () => {
  it("is true for master and develop only", () => {
    assert.equal(isProtectedBranch("master"), true);
    assert.equal(isProtectedBranch("develop"), true);
    for (const name of [
      "main",
      "develop-x",
      "feat/master",
      "staging",
      "",
      "Master",
    ]) {
      assert.equal(isProtectedBranch(name), false, name);
    }
  });
});

describe("isWorkBranch", () => {
  const prefixes = DEFAULT_BRANCH_FLOW.workBranchPrefixes;

  it("takes a configured prefix, a slash and a slug", () => {
    for (const name of [
      "feat/login",
      "fix/x",
      "chore/a/b",
      "docs/readme",
      "feat/master",
    ]) {
      assert.equal(isWorkBranch(name, prefixes), true, name);
    }
  });

  it("rejects a missing slug, another prefix, another case and a longer prefix", () => {
    for (const name of [
      "feat",
      "feat/",
      "feature/x",
      "Feat/x",
      "xfeat/x",
      "develop",
      "master",
      "",
    ]) {
      assert.equal(isWorkBranch(name, prefixes), false, name);
    }
  });

  it("follows the prefixes it is given", () => {
    assert.equal(
      isWorkBranch("ops/deploy", CUSTOM_BRANCH_FLOW.workBranchPrefixes),
      true,
    );
    assert.equal(isWorkBranch("ops/deploy", prefixes), false);
    assert.equal(
      isWorkBranch("docs/readme", CUSTOM_BRANCH_FLOW.workBranchPrefixes),
      false,
    );
  });
});

describe("classifyPushTarget with the default configuration", () => {
  const allowed = [
    "refs/heads/feat/login",
    "refs/heads/fix/x",
    "refs/heads/chore/branch-flow-guard",
    "refs/heads/docs/readme",
    "refs/heads/feat/a/b",
    "refs/heads/feat/master",
    "refs/tags/v1.0.0",
    "refs/tags/master",
  ];
  for (const ref of allowed) {
    it(`allows a push to ${ref}`, () => {
      assert.equal(
        classifyPushTarget(ref, SHA, DEFAULT_BRANCH_FLOW).allowed,
        true,
      );
    });
    it(`allows a delete of ${ref}`, () => {
      assert.equal(
        classifyPushTarget(ref, ZERO, DEFAULT_BRANCH_FLOW).allowed,
        true,
      );
    });
  }

  const blocked = [
    "refs/heads/master",
    "refs/heads/develop",
    "refs/heads/feat",
    "refs/heads/feat/",
    "refs/heads/develop-x",
    "refs/heads/master/x",
    "refs/heads/feature/x",
    "refs/heads/hotfix/x",
    "refs/heads/Feat/x",
    "refs/heads/xfeat/x",
    "refs/heads/ops/deploy",
    "refs/heads/staging",
    "refs/heads/worktree-login",
    "refs/heads/main",
    "refs/heads/",
    "refs/tags/",
    "refs/notes/commits",
    "master",
    "",
  ];
  for (const ref of blocked) {
    it(`blocks a push to '${ref}'`, () => {
      assert.equal(
        classifyPushTarget(ref, SHA, DEFAULT_BRANCH_FLOW).allowed,
        false,
      );
    });
    it(`blocks a delete of '${ref}'`, () => {
      assert.equal(
        classifyPushTarget(ref, ZERO, DEFAULT_BRANCH_FLOW).allowed,
        false,
      );
    });
  }

  it("gives a one-line reason naming the branch and the way out", () => {
    const { reason } = classifyPushTarget(
      "refs/heads/master",
      SHA,
      DEFAULT_BRANCH_FLOW,
    );
    assert.match(reason, /'master'/);
    assert.match(reason, /pull request/);
    assert.doesNotMatch(reason, /\n/);
    assert.match(
      classifyPushTarget("refs/heads/feature/x", SHA, DEFAULT_BRANCH_FLOW)
        .reason,
      /branch names must be feat\|fix\|chore\|docs\/<slug>$/,
    );
  });

  it("names a delete as a delete", () => {
    assert.match(
      classifyPushTarget("refs/heads/develop", ZERO, DEFAULT_BRANCH_FLOW)
        .reason,
      /delete of 'develop'/,
    );
    assert.match(
      classifyPushTarget("refs/heads/develop", SHA, DEFAULT_BRANCH_FLOW).reason,
      /push to 'develop'/,
    );
  });
});

describe("classifyPushTarget with a custom configuration", () => {
  for (const ref of [
    "refs/heads/ops/deploy",
    "refs/heads/feat/login",
    "refs/heads/staging",
  ]) {
    it(`allows a push to and a delete of ${ref}`, () => {
      assert.equal(
        classifyPushTarget(ref, SHA, CUSTOM_BRANCH_FLOW).allowed,
        true,
      );
      assert.equal(
        classifyPushTarget(ref, ZERO, CUSTOM_BRANCH_FLOW).allowed,
        true,
      );
    });
  }

  const blocked = [
    "refs/heads/docs/readme",
    "refs/heads/chore/x",
    "refs/heads/staging/x",
    "refs/heads/staging2",
    "refs/heads/master",
    "refs/heads/develop",
  ];
  for (const ref of blocked) {
    it(`blocks a push to ${ref}`, () => {
      assert.equal(
        classifyPushTarget(ref, SHA, CUSTOM_BRANCH_FLOW).allowed,
        false,
      );
    });
  }

  it("names the configured prefixes and long-lived branches in the reason", () => {
    assert.match(
      classifyPushTarget("refs/heads/docs/readme", SHA, CUSTOM_BRANCH_FLOW)
        .reason,
      /branch names must be feat\|fix\|ops\/<slug> or one of staging$/,
    );
  });
});

describe("pushProblems", () => {
  it("reads git's pre-push lines and reports each blocked ref on one line", () => {
    const input = [
      `refs/heads/feat/login ${SHA} refs/heads/feat/login ${ZERO}`,
      `refs/heads/develop ${SHA} refs/heads/develop ${BEFORE}`,
      "",
      `(delete) ${ZERO} refs/heads/master ${BEFORE}`,
      `refs/tags/v1.0.0 ${SHA} refs/tags/v1.0.0 ${ZERO}`,
    ].join("\n");
    const problems = pushProblems(input, DEFAULT_BRANCH_FLOW);
    assert.equal(problems.length, 2);
    assert.match(problems[0], /^direct push to 'develop' is blocked/);
    assert.match(problems[1], /^direct delete of 'master' is blocked/);
    for (const problem of problems) {
      assert.match(
        problem,
        /Push a feat\|fix\|chore\|docs\/<slug> branch, open a pull request/,
      );
      assert.match(problem, /style-guide merge <number>$/);
      assert.doesNotMatch(problem, /\n/);
    }
  });

  it("passes input with no refs", () => {
    assert.deepEqual(pushProblems("", DEFAULT_BRANCH_FLOW), []);
    assert.deepEqual(pushProblems("\n", DEFAULT_BRANCH_FLOW), []);
  });

  it("blocks a line that names no remote ref", () => {
    assert.equal(
      pushProblems("refs/heads/feat/x", DEFAULT_BRANCH_FLOW).length,
      1,
    );
  });

  it("lets a long-lived branch through only where it is configured", () => {
    const input = `refs/heads/staging ${SHA} refs/heads/staging ${BEFORE}\n`;
    assert.deepEqual(pushProblems(input, CUSTOM_BRANCH_FLOW), []);
    assert.equal(pushProblems(input, DEFAULT_BRANCH_FLOW).length, 1);
  });
});

describe("commitProblem", () => {
  it("blocks a commit on master and on develop with a one-line reason", () => {
    for (const branch of ["master", "develop"]) {
      const problem = commitProblem(branch, DEFAULT_BRANCH_FLOW);
      assert.match(problem, new RegExp(`^commit on '${branch}' is blocked`));
      assert.match(
        problem,
        /Commit on a feat\|fix\|chore\|docs\/<slug> branch/,
      );
      assert.doesNotMatch(problem, /\n/);
    }
  });

  it("passes a work branch, a long-lived branch, any other branch and a detached HEAD", () => {
    for (const branch of ["feat/login", "staging", "worktree-login", ""]) {
      assert.equal(commitProblem(branch, DEFAULT_BRANCH_FLOW), null, branch);
    }
  });

  it("names the configured prefixes in the way out", () => {
    assert.match(
      commitProblem("master", CUSTOM_BRANCH_FLOW),
      /Commit on a feat\|fix\|ops\/<slug> branch/,
    );
  });
});

describe("decideMerge", () => {
  for (const head of ["feat/a", "fix/a", "chore/a", "docs/a", "feat/a/b"]) {
    it(`squashes ${head} into develop and deletes the branch`, () => {
      assert.deepEqual(
        decideMerge({ base: "develop", head }, DEFAULT_BRANCH_FLOW),
        {
          method: "squash",
          deleteBranch: true,
        },
      );
    });
  }

  it("merges develop into master with a merge commit and keeps develop", () => {
    assert.deepEqual(
      decideMerge({ base: "master", head: "develop" }, DEFAULT_BRANCH_FLOW),
      {
        method: "merge",
        deleteBranch: false,
      },
    );
  });

  const refusals = [
    { base: "master", head: "feat/a" },
    { base: "master", head: "master" },
    { base: "develop", head: "master" },
    { base: "develop", head: "develop" },
    { base: "develop", head: "ops/a" },
    { base: "develop", head: "feature/a" },
    { base: "develop", head: "feat" },
    { base: "develop", head: "feat/" },
    { base: "develop", head: "worktree-x" },
    { base: "feat/a", head: "fix/b" },
    { base: "main", head: "develop" },
    { base: "develop-x", head: "feat/a" },
  ];
  for (const pair of refusals) {
    it(`refuses ${pair.head} -> ${pair.base}`, () => {
      const decision = decideMerge(pair, DEFAULT_BRANCH_FLOW);
      assert.deepEqual(Object.keys(decision), ["refused"]);
      assert.equal(typeof decision.refused, "string");
      assert.doesNotMatch(decision.refused, /\n/);
    });
  }

  it("squashes a branch with a configured extra prefix", () => {
    assert.deepEqual(
      decideMerge({ base: "develop", head: "ops/a" }, CUSTOM_BRANCH_FLOW),
      {
        method: "squash",
        deleteBranch: true,
      },
    );
  });

  it("never merges a long-lived branch, and never merges into one", () => {
    const refusals = [
      { base: "develop", head: "staging" },
      { base: "master", head: "staging" },
      { base: "staging", head: "feat/a" },
    ];
    for (const pair of refusals) {
      assert.deepEqual(
        Object.keys(decideMerge(pair, CUSTOM_BRANCH_FLOW)),
        ["refused"],
        JSON.stringify(pair),
      );
    }
  });
});

describe("mergeCommands", () => {
  const repo = "acme/web";
  const work = {
    number: "14",
    repo,
    title: "docs: describe the login flow",
    headRef: "docs/login-flow",
  };
  const release = {
    number: "9",
    repo,
    title: "release: login (1.2.0)",
    headRef: "develop",
  };
  const squash = { method: "squash", deleteBranch: true };
  const mergeCommit = { method: "merge", deleteBranch: false };

  it("squashes a pull request outside a stack with gh pr merge and deletes the branch", () => {
    assert.deepEqual(mergeCommands({ ...work, inStack: false }, squash), [
      ["pr", "merge", "14", "--repo", repo, "--squash", "--delete-branch"],
    ]);
  });

  it("merges develop into master with the subject '<title> (#<number>)'", () => {
    assert.deepEqual(
      mergeCommands({ ...release, inStack: false }, mergeCommit),
      [
        [
          "pr",
          "merge",
          "9",
          "--repo",
          repo,
          "--merge",
          "--subject",
          "release: login (1.2.0) (#9)",
        ],
      ],
    );
  });

  it("squashes a stacked pull request with gh stack merge, then deletes its head branch", () => {
    assert.deepEqual(mergeCommands({ ...work, inStack: true }, squash), [
      ["stack", "merge", "14", "--squash", "--yes"],
      ["api", "-X", "DELETE", "repos/acme/web/git/refs/heads/docs/login-flow"],
    ]);
  });

  it("deletes exactly the head branch of a stacked pull request when its name holds # or %", () => {
    const commands = mergeCommands(
      { ...work, headRef: "docs/a#b%c", inStack: true },
      squash,
    );
    assert.deepEqual(commands[1], [
      "api",
      "-X",
      "DELETE",
      "repos/acme/web/git/refs/heads/docs/a%23b%25c",
    ]);
  });

  it("refuses a stacked pull request into master", () => {
    const commands = mergeCommands({ ...release, inStack: true }, mergeCommit);
    assert.deepEqual(Object.keys(commands), ["refused"]);
    assert.equal(typeof commands.refused, "string");
    assert.doesNotMatch(commands.refused, /\n/);
  });
});

describe("planMerge", () => {
  const candidate = {
    number: "14",
    repo: "acme/web",
    base: "develop",
    head: "feat/login",
    state: "OPEN",
    isDraft: false,
    title: "feat: add the login form",
    inStack: false,
  };

  it("plans the squash of an open work branch into develop", () => {
    assert.deepEqual(planMerge(candidate, DEFAULT_BRANCH_FLOW), [
      [
        "pr",
        "merge",
        "14",
        "--repo",
        "acme/web",
        "--squash",
        "--delete-branch",
      ],
    ]);
  });

  it("plans the merge commit of develop into master", () => {
    const release = {
      ...candidate,
      base: "master",
      head: "develop",
      title: "release: login",
    };
    assert.deepEqual(planMerge(release, DEFAULT_BRANCH_FLOW), [
      [
        "pr",
        "merge",
        "14",
        "--repo",
        "acme/web",
        "--merge",
        "--subject",
        "release: login (#14)",
      ],
    ]);
  });

  it("plans a stacked pull request through gh stack merge", () => {
    assert.deepEqual(
      planMerge({ ...candidate, inStack: true }, DEFAULT_BRANCH_FLOW),
      [
        ["stack", "merge", "14", "--squash", "--yes"],
        ["api", "-X", "DELETE", "repos/acme/web/git/refs/heads/feat/login"],
      ],
    );
  });

  it("refuses a closed or merged pull request", () => {
    assert.deepEqual(
      planMerge({ ...candidate, state: "CLOSED" }, DEFAULT_BRANCH_FLOW),
      {
        refused: "is CLOSED, not OPEN",
      },
    );
    assert.deepEqual(
      planMerge({ ...candidate, state: "MERGED" }, DEFAULT_BRANCH_FLOW),
      {
        refused: "is MERGED, not OPEN",
      },
    );
  });

  it("refuses a draft", () => {
    assert.match(
      planMerge({ ...candidate, isDraft: true }, DEFAULT_BRANCH_FLOW).refused,
      /is a draft/,
    );
  });

  it("refuses a wrong pairing", () => {
    const intoMaster = planMerge(
      { ...candidate, base: "master" },
      DEFAULT_BRANCH_FLOW,
    );
    assert.match(intoMaster.refused, /master takes only develop/);
    const badHead = planMerge(
      { ...candidate, head: "wip" },
      DEFAULT_BRANCH_FLOW,
    );
    assert.match(
      badHead.refused,
      /the head must be feat\|fix\|chore\|docs\/<slug>/,
    );
  });
});

const pairProblem = (base, head) =>
  pullRequestPairProblem({ base, head }, DEFAULT_BRANCH_FLOW);
const customPairProblem = (base, head) =>
  pullRequestPairProblem({ base, head }, CUSTOM_BRANCH_FLOW);

describe("pullRequestPairProblem with the default configuration", () => {
  it("accepts a work branch into develop, develop into master, and a stack layer", () => {
    assert.equal(pairProblem("develop", "feat/a"), null);
    assert.equal(pairProblem("develop", "docs/a"), null);
    assert.equal(pairProblem("master", "develop"), null);
    assert.equal(pairProblem("feat/a", "feat/b"), null);
  });

  it("rejects a work branch into master", () => {
    assert.match(pairProblem("master", "feat/a"), /master takes only develop/);
  });

  it("rejects a head outside the work branch names", () => {
    assert.match(pairProblem("develop", "wip"), /must be feat\|fix/);
    assert.match(pairProblem("develop", "master"), /must be feat\|fix/);
    assert.match(pairProblem("feat/a", "develop"), /must be feat\|fix/);
    assert.match(pairProblem("develop", "ops/a"), /must be feat\|fix/);
  });

  it("rejects a base outside the flow", () => {
    assert.match(pairProblem("release", "feat/a"), /not part of the flow/);
  });
});

describe("pullRequestPairProblem with a custom configuration", () => {
  it("accepts a configured extra prefix as head and as the base of a stack layer", () => {
    assert.equal(customPairProblem("develop", "ops/a"), null);
    assert.equal(customPairProblem("ops/a", "feat/b"), null);
  });

  it("rejects a prefix the configuration dropped", () => {
    assert.match(
      customPairProblem("develop", "docs/a"),
      /must be feat\|fix\|ops\/<slug>/,
    );
  });

  it("rejects a long-lived branch as the head into develop or master, and as a base", () => {
    assert.match(
      customPairProblem("develop", "staging"),
      /must be feat\|fix\|ops\/<slug>/,
    );
    assert.match(
      customPairProblem("master", "staging"),
      /master takes only develop/,
    );
    assert.match(
      customPairProblem("staging", "feat/a"),
      /not part of the flow/,
    );
  });
});

const mergedPull = (overrides) => ({
  number: 7,
  base: "develop",
  head: "feat/a",
  mergeCommitSha: MERGE,
  merged: true,
  ...overrides,
});

const squashOnDevelop = (overrides) => ({
  branch: "develop",
  before: BEFORE,
  forced: false,
  commit: { sha: MERGE, parents: [BEFORE] },
  pulls: [mergedPull({})],
  ...overrides,
});

const mergeOnMaster = (overrides) => ({
  branch: "master",
  before: BEFORE,
  forced: false,
  commit: { sha: MERGE, parents: [BEFORE, DEVELOP_TIP] },
  pulls: [mergedPull({ number: 8, base: "master", head: "develop" })],
  ...overrides,
});

const landedProblem = (landed) =>
  landedCommitProblem(landed, DEFAULT_BRANCH_FLOW);

describe("landedCommitProblem: how the branch moved", () => {
  it("accepts a squash merge on develop and a merge commit from develop on master", () => {
    assert.equal(landedProblem(squashOnDevelop({})), null);
    assert.equal(landedProblem(mergeOnMaster({})), null);
  });

  it("rejects a force push", () => {
    assert.match(
      landedProblem(squashOnDevelop({ forced: true })),
      /develop was force-pushed/,
    );
  });

  it("rejects a push that created the branch", () => {
    assert.match(
      landedProblem(squashOnDevelop({ before: ZERO })),
      /develop was created/,
    );
  });

  it("rejects a push that moved the branch by more than one commit", () => {
    const commit = { sha: MERGE, parents: [DEVELOP_TIP] };
    assert.match(
      landedProblem(squashOnDevelop({ commit })),
      /more than one first-parent commit/,
    );
  });

  it("rejects a merge commit on develop and a squash on master", () => {
    const mergeCommit = { sha: MERGE, parents: [BEFORE, DEVELOP_TIP] };
    assert.match(
      landedProblem(squashOnDevelop({ commit: mergeCommit })),
      /#7 landed on develop as a commit with 2 parent\(s\): develop takes squash commits/,
    );
    const squash = { sha: MERGE, parents: [BEFORE] };
    assert.match(
      landedProblem(mergeOnMaster({ commit: squash })),
      /#8 landed on master as a commit with 1 parent\(s\): master takes merge commits/,
    );
  });
});

describe("landedCommitProblem: the pull request behind the commit", () => {
  const notFromPullRequest = /did not come from a merged pull request/;

  it("rejects a commit with no pull request", () => {
    assert.match(
      landedProblem(squashOnDevelop({ pulls: [] })),
      notFromPullRequest,
    );
  });

  it("rejects a pull request that is not merged, or that merged as another commit", () => {
    const open = [mergedPull({ merged: false })];
    const other = [mergedPull({ mergeCommitSha: DEVELOP_TIP })];
    for (const pulls of [open, other]) {
      assert.match(
        landedProblem(squashOnDevelop({ pulls })),
        notFromPullRequest,
      );
    }
  });

  it("finds the merged pull request among the others GitHub lists for the commit", () => {
    const pulls = [mergedPull({ number: 6, merged: false }), mergedPull({})];
    assert.equal(landedProblem(squashOnDevelop({ pulls })), null);
  });

  it("rejects a work branch merged straight into master", () => {
    const pulls = [mergedPull({ number: 9, base: "master" })];
    assert.match(
      landedProblem(mergeOnMaster({ pulls })),
      /#9: 'feat\/a' targets master: master takes only develop/,
    );
  });

  it("rejects a pull request that was merged into another base", () => {
    const pulls = [mergedPull({ number: 10, base: "feat/a", head: "feat/b" })];
    assert.match(
      landedProblem(squashOnDevelop({ pulls })),
      /#10 targeted feat\/a, not develop/,
    );
  });
});

describe("landedCommitProblem with a custom configuration", () => {
  it("follows the configured prefixes for the head of the merged pull request", () => {
    const landed = squashOnDevelop({
      pulls: [mergedPull({ number: 11, head: "ops/a" })],
    });
    assert.equal(landedCommitProblem(landed, CUSTOM_BRANCH_FLOW), null);
    assert.match(landedProblem(landed), /#11: the head 'ops\/a'/);
  });

  it("rejects a long-lived branch merged into develop", () => {
    const landed = squashOnDevelop({
      pulls: [mergedPull({ number: 12, head: "staging" })],
    });
    assert.match(
      landedCommitProblem(landed, CUSTOM_BRANCH_FLOW),
      /#12: the head 'staging'/,
    );
  });
});
