import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AFTER_SEVERAL_COMMITS,
  canBeRebaseMergeOf,
  carriedCommitLines,
  carriedSeveralCommits,
  classifyPushTarget,
  commitProblem,
  decideMerge,
  isProtectedBranch,
  isWorkBranch,
  landedCommitProblem,
  mergeCommands,
  nextCommitToWalk,
  planMerge,
  pullRequestPairProblem,
  pushProblems,
  REBASE_MERGE_COMMIT_LIMIT,
  rebaseMergeCandidate,
  unwalkedRebaseMergeLine,
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
    assert.equal(
      landedProblem(squashOnDevelop({ commit: mergeCommit })),
      "#7 landed on develop as a commit with 2 parent(s): develop takes squash commits or rebased commits",
    );
    const squash = { sha: MERGE, parents: [BEFORE] };
    assert.match(
      landedProblem(mergeOnMaster({ commit: squash })),
      /#8 landed on master as a commit with 1 parent\(s\): master takes merge commits/,
    );
  });
});

describe("carriedSeveralCommits", () => {
  it("is true only for a push that moved the branch by more than one first-parent commit", () => {
    const commit = { sha: MERGE, parents: [DEVELOP_TIP] };
    assert.equal(carriedSeveralCommits(squashOnDevelop({ commit })), true);
    assert.equal(carriedSeveralCommits(squashOnDevelop({})), false);
    assert.equal(carriedSeveralCommits(mergeOnMaster({})), false);
  });

  it("is false for a force push and for the creation of the branch, which fail for their own reason", () => {
    const commit = { sha: MERGE, parents: [DEVELOP_TIP] };
    for (const overrides of [{ forced: true }, { before: ZERO }]) {
      const landed = squashOnDevelop({ commit, ...overrides });
      assert.equal(carriedSeveralCommits(landed), false);
      assert.doesNotMatch(
        landedProblem(landed),
        /more than one first-parent commit/,
      );
    }
  });

  it("is true exactly when landedCommitProblem gives that reason, on one line", () => {
    const commit = { sha: MERGE, parents: [DEVELOP_TIP] };
    for (const landed of [
      squashOnDevelop({ commit }),
      squashOnDevelop({ commit, pulls: [] }),
      mergeOnMaster({ commit: { sha: MERGE, parents: [DEVELOP_TIP, BEFORE] } }),
    ]) {
      assert.equal(carriedSeveralCommits(landed), true);
      assert.equal(
        landedProblem(landed),
        `${landed.branch} moved from ${BEFORE} to ${MERGE} by more than one first-parent commit`,
      );
    }
  });
});

// Pull request #7 had three commits. A rebase merge put them onto develop as REBASED_FIRST, REBASED_SECOND and MERGE,
// one parent each and with the message and author of each, and GitHub records MERGE, the commit develop moved to, as
// the pull request's merge_commit_sha. PULL_HEAD was the last commit of the pull request's branch.
const REBASED_FIRST = "6666666666666666666666666666666666666666";
const REBASED_SECOND = "7777777777777777777777777777777777777777";
const PUSHED_DIRECTLY = "8888888888888888888888888888888888888888";
const PULL_HEAD = "9999999999999999999999999999999999999999";

const AUTHOR = { authorName: "A. Author", authorEmail: "author@example.com" };
const PULL_COMMITS = [
  { message: "feat: add the login form", ...AUTHOR },
  { message: "feat: validate the login form", ...AUTHOR },
  { message: "feat: remember the last login\n\nKeeps the address.", ...AUTHOR },
];
const [ADD_FORM, VALIDATE_FORM, REMEMBER_LOGIN] = PULL_COMMITS;

const walked = (sha, parents, identity) => ({ sha, parents, ...identity });

const REBASE_WALK = {
  pull: { number: 7, commits: 3, headSha: PULL_HEAD, stacked: false },
  pullCommits: PULL_COMMITS,
  firstParents: [
    walked(MERGE, [REBASED_SECOND], REMEMBER_LOGIN),
    walked(REBASED_SECOND, [REBASED_FIRST], VALIDATE_FORM),
    walked(REBASED_FIRST, [BEFORE], ADD_FORM),
  ],
};

const rebaseOnDevelop = (rebaseWalk) =>
  squashOnDevelop({
    commit: { sha: MERGE, parents: [REBASED_SECOND] },
    rebaseWalk: { ...REBASE_WALK, ...rebaseWalk },
  });

/**
 * A pull request of `commits` commits, told apart by their messages, rebased onto develop.
 * @param {number} commits
 */
function rebaseOfCommits(commits) {
  const pullCommits = Array.from({ length: commits }, (_, index) => ({
    message: `chore: step ${index + 1}`,
    ...AUTHOR,
  }));
  const shas = pullCommits.map((_, index) =>
    index === commits - 1 ? MERGE : (index + 1).toString(16).padStart(40, "a"),
  );
  const firstParents = shas
    .map((sha, index) =>
      walked(sha, [shas[index - 1] ?? BEFORE], pullCommits[index]),
    )
    .reverse();
  return squashOnDevelop({
    commit: { sha: MERGE, parents: [shas.at(-2) ?? BEFORE] },
    rebaseWalk: {
      pull: { number: 7, commits, headSha: PULL_HEAD, stacked: false },
      pullCommits,
      firstParents,
    },
  });
}

describe("landedCommitProblem: a push that moved develop by several commits as a rebase merge", () => {
  const severalCommits = `develop moved from ${BEFORE} to ${MERGE} by more than one first-parent commit`;

  it("accepts the commits of one merged pull request, rebased onto develop", () => {
    assert.equal(landedProblem(rebaseOnDevelop({})), null);
  });

  it("rejects a walk that does not reach before: the pull request's commits sit on a commit pushed with them", () => {
    const firstParents = [
      walked(MERGE, [REBASED_SECOND], REMEMBER_LOGIN),
      walked(REBASED_SECOND, [REBASED_FIRST], VALIDATE_FORM),
      walked(REBASED_FIRST, [PUSHED_DIRECTLY], ADD_FORM),
    ];
    assert.equal(
      landedProblem(rebaseOnDevelop({ firstParents })),
      severalCommits,
    );
  });

  it("rejects a walk that meets a commit with two parents, even when its first parents reach before", () => {
    const firstParents = [
      walked(MERGE, [REBASED_SECOND], REMEMBER_LOGIN),
      walked(REBASED_SECOND, [REBASED_FIRST, DEVELOP_TIP], VALIDATE_FORM),
      walked(REBASED_FIRST, [BEFORE], ADD_FORM),
    ];
    assert.equal(
      landedProblem(rebaseOnDevelop({ firstParents })),
      severalCommits,
    );
  });

  it("rejects a walk whose commit count is not the pull request's", () => {
    const fewer = {
      pull: { ...REBASE_WALK.pull, commits: 2 },
      pullCommits: PULL_COMMITS.slice(1),
      firstParents: REBASE_WALK.firstParents.slice(0, 2),
    };
    const more = {
      pull: { ...REBASE_WALK.pull, commits: 4 },
      pullCommits: [{ message: "chore: start", ...AUTHOR }, ...PULL_COMMITS],
    };
    for (const rebaseWalk of [fewer, more]) {
      assert.equal(landedProblem(rebaseOnDevelop(rebaseWalk)), severalCommits);
    }
  });

  it("rejects a walk when GitHub lists another number of commits for the pull request than it counts", () => {
    const pullCommits = [
      { message: "chore: start", ...AUTHOR },
      ...PULL_COMMITS,
    ];
    assert.equal(
      landedProblem(rebaseOnDevelop({ pullCommits })),
      severalCommits,
    );
  });

  it("rejects the squash commits of a stack landed at once, even when the top one has the pull request's last message", () => {
    const firstParents = [
      walked(MERGE, [REBASED_SECOND], REMEMBER_LOGIN),
      walked(REBASED_SECOND, [REBASED_FIRST], {
        ...VALIDATE_FORM,
        message: "feat: validate the login form (#12)",
      }),
      walked(REBASED_FIRST, [BEFORE], {
        ...ADD_FORM,
        message: "feat: add the login form (#11)",
      }),
    ];
    assert.equal(
      landedProblem(rebaseOnDevelop({ firstParents })),
      severalCommits,
    );
  });

  it("rejects a walk with a commit whose message or author is not that of the pull request's commit at the same place", () => {
    const changes = [
      { message: "feat: add the login form\n" },
      { authorName: "B. Author" },
      { authorEmail: "author@example.org" },
    ];
    for (const [depth, commit] of REBASE_WALK.firstParents.entries()) {
      for (const change of changes) {
        const firstParents = REBASE_WALK.firstParents.with(depth, {
          ...commit,
          ...change,
        });
        assert.equal(
          landedProblem(rebaseOnDevelop({ firstParents })),
          severalCommits,
        );
      }
    }
  });

  it("rejects the pull request's commits rebased in another order", () => {
    const pullCommits = [VALIDATE_FORM, ADD_FORM, REMEMBER_LOGIN];
    assert.equal(
      landedProblem(rebaseOnDevelop({ pullCommits })),
      severalCommits,
    );
  });

  it("rejects a walk that does not start at the tip", () => {
    const firstParents = [
      walked(DEVELOP_TIP, [REBASED_SECOND], REMEMBER_LOGIN),
      ...REBASE_WALK.firstParents.slice(1),
    ];
    assert.equal(
      landedProblem(rebaseOnDevelop({ firstParents })),
      severalCommits,
    );
  });

  it("rejects a tip that is the pull request's head: GitHub's rebase merge always writes new commits", () => {
    const pull = { ...REBASE_WALK.pull, headSha: MERGE };
    assert.equal(landedProblem(rebaseOnDevelop({ pull })), severalCommits);
  });

  it("rejects a pull request in a GitHub stack, even when the walk meets every other condition", () => {
    const pull = { ...REBASE_WALK.pull, stacked: true };
    assert.equal(landedProblem(rebaseOnDevelop({ pull })), severalCommits);
    assert.equal(landedProblem(rebaseOnDevelop({})), null);
  });

  it(`walks a pull request of up to ${REBASE_MERGE_COMMIT_LIMIT} commits and rejects one with more`, () => {
    for (const commits of [2, REBASE_MERGE_COMMIT_LIMIT]) {
      assert.equal(landedProblem(rebaseOfCommits(commits)), null);
    }
    const landed = rebaseOfCommits(REBASE_MERGE_COMMIT_LIMIT + 1);
    assert.equal(landed.rebaseWalk.firstParents.length, 101);
    assert.equal(landed.rebaseWalk.firstParents.at(-1).parents[0], BEFORE);
    assert.equal(landedProblem(landed), severalCommits);
  });

  it("rejects the walk when the tip is not the merge_commit_sha of a merged pull request the flow takes into develop", () => {
    for (const pulls of [
      [],
      [mergedPull({ merged: false })],
      [mergedPull({ head: "staging" })],
      [mergedPull({ base: "feat/a", head: "feat/b" })],
    ]) {
      const landed = { ...rebaseOnDevelop({}), pulls };
      assert.equal(landedProblem(landed), severalCommits);
    }
  });

  it("keeps master to one first-parent commit per push, even for a push that meets every condition of a rebase merge into develop", () => {
    const landed = { ...rebaseOnDevelop({}), branch: "master" };
    assert.equal(
      landedProblem(landed),
      `master moved from ${BEFORE} to ${MERGE} by more than one first-parent commit`,
    );
  });
});

describe("rebaseMergeCandidate", () => {
  const candidateOf = (landed) =>
    rebaseMergeCandidate(landed, DEFAULT_BRANCH_FLOW);

  it("names the merged pull request into develop whose merge_commit_sha is the tip of a push of several commits", () => {
    const pulls = [mergedPull({ number: 6, merged: false }), mergedPull({})];
    assert.deepEqual(
      candidateOf({ ...rebaseOnDevelop({}), pulls }),
      mergedPull({}),
    );
  });

  it("names none for a push that moved develop by one commit, or that was forced or created the branch", () => {
    assert.equal(candidateOf(squashOnDevelop({})), undefined);
    for (const overrides of [{ forced: true }, { before: ZERO }]) {
      assert.equal(
        candidateOf({ ...rebaseOnDevelop({}), ...overrides }),
        undefined,
      );
    }
  });

  it("names none on master, even for a merged pull request into develop", () => {
    assert.equal(
      candidateOf({ ...rebaseOnDevelop({}), branch: "master" }),
      undefined,
    );
  });

  it("names none when the pull request is not one the flow takes into develop", () => {
    for (const pull of [
      mergedPull({ mergeCommitSha: DEVELOP_TIP }),
      mergedPull({ base: "feat/a", head: "feat/b" }),
      mergedPull({ head: "ops/a" }),
    ]) {
      const landed = { ...rebaseOnDevelop({}), pulls: [pull] };
      assert.equal(candidateOf(landed), undefined);
    }
  });

  it("follows the configured prefixes for the head of the pull request", () => {
    const pull = mergedPull({ head: "ops/a" });
    const landed = { ...rebaseOnDevelop({}), pulls: [pull] };
    assert.deepEqual(rebaseMergeCandidate(landed, CUSTOM_BRANCH_FLOW), pull);
  });
});

describe("canBeRebaseMergeOf", () => {
  const pullOf = (commits, headSha = PULL_HEAD, stacked = false) => ({
    number: 7,
    commits,
    headSha,
    stacked,
  });

  it(`is true for a pull request of 2 to ${REBASE_MERGE_COMMIT_LIMIT} commits whose head is not the tip`, () => {
    for (const commits of [2, 3, REBASE_MERGE_COMMIT_LIMIT]) {
      assert.equal(canBeRebaseMergeOf(pullOf(commits), MERGE), true);
    }
  });

  it(`is false for a pull request of fewer than 2 or more than ${REBASE_MERGE_COMMIT_LIMIT} commits`, () => {
    for (const commits of [0, 1, REBASE_MERGE_COMMIT_LIMIT + 1]) {
      assert.equal(canBeRebaseMergeOf(pullOf(commits), MERGE), false);
    }
  });

  it("is false when the tip is the pull request's head", () => {
    assert.equal(canBeRebaseMergeOf(pullOf(3, MERGE), MERGE), false);
  });

  it("is false for a pull request in a GitHub stack, whatever its commits", () => {
    for (const commits of [2, 3, REBASE_MERGE_COMMIT_LIMIT]) {
      assert.equal(
        canBeRebaseMergeOf(pullOf(commits, PULL_HEAD, true), MERGE),
        false,
      );
    }
  });
});

describe("unwalkedRebaseMergeLine", () => {
  it(`names nothing for a pull request of at most ${REBASE_MERGE_COMMIT_LIMIT} commits`, () => {
    for (const commits of [0, 3, REBASE_MERGE_COMMIT_LIMIT]) {
      assert.equal(
        unwalkedRebaseMergeLine({ number: 7, commits, headSha: PULL_HEAD }),
        null,
      );
    }
  });

  it("says why the check did not walk a pull request with more commits", () => {
    assert.equal(
      unwalkedRebaseMergeLine({ number: 7, commits: 101, headSha: PULL_HEAD }),
      "Whether the push is the rebase merge of #7 was not checked: #7 has 101 commits, " +
        "and a pull request with more than 100 commits is squashed, not rebased",
    );
  });
});

describe("nextCommitToWalk", () => {
  const walkOf = (commits, depth) => ({
    ...REBASE_WALK,
    pull: { ...REBASE_WALK.pull, commits },
    firstParents: REBASE_WALK.firstParents.slice(0, depth),
  });

  it("names the first parent of the last commit read while the walk has fewer commits than the pull request", () => {
    assert.equal(nextCommitToWalk(walkOf(3, 1), BEFORE), REBASED_SECOND);
    assert.equal(nextCommitToWalk(walkOf(3, 2), BEFORE), REBASED_FIRST);
  });

  it("stops once the walk has as many commits as the pull request", () => {
    assert.equal(nextCommitToWalk(walkOf(3, 3), BEFORE), null);
    assert.equal(nextCommitToWalk(walkOf(2, 2), BEFORE), null);
  });

  it("stops at before, even when the pull request has more commits", () => {
    assert.equal(nextCommitToWalk(walkOf(4, 3), BEFORE), null);
  });

  it("stops at a commit that has not exactly one parent", () => {
    for (const parents of [[], [REBASED_FIRST, DEVELOP_TIP]]) {
      const rebaseWalk = {
        ...walkOf(3, 2),
        firstParents: [
          walked(MERGE, [REBASED_SECOND], REMEMBER_LOGIN),
          walked(REBASED_SECOND, parents, VALIDATE_FORM),
        ],
      };
      assert.equal(nextCommitToWalk(rebaseWalk, BEFORE), null);
    }
  });

  it("stops at a commit whose message or author is not that of the pull request's commit at the same place", () => {
    const squashOfLayer = {
      ...VALIDATE_FORM,
      message: "feat: validate the login form (#12)",
    };
    for (const firstParents of [
      [walked(MERGE, [REBASED_SECOND], squashOfLayer)],
      [
        walked(MERGE, [REBASED_SECOND], REMEMBER_LOGIN),
        walked(REBASED_SECOND, [REBASED_FIRST], squashOfLayer),
      ],
    ]) {
      const rebaseWalk = { ...walkOf(3, 0), firstParents };
      assert.equal(nextCommitToWalk(rebaseWalk, BEFORE), null);
    }
  });

  it("names nothing before the tip is read", () => {
    assert.equal(nextCommitToWalk(walkOf(3, 0), BEFORE), null);
  });
});

describe("carriedCommitLines", () => {
  const FIRST = "4444444444444444444444444444444444444444";
  const squashOf = (number, sha) => [
    mergedPull({ number, mergeCommitSha: sha }),
  ];

  it("counts the commits and names each by short sha, merged pull request and subject", () => {
    const listed = [
      {
        sha: FIRST,
        subject: "feat: add the login form (#11)",
        pulls: squashOf(11, FIRST),
      },
      {
        sha: MERGE,
        subject: "feat: validate it (#12)",
        pulls: squashOf(12, MERGE),
      },
    ];
    assert.deepEqual(carriedCommitLines(listed, 2), [
      "The push event lists 2 commit(s):",
      "  4444444 pull request #11: feat: add the login form (#11)",
      "  2222222 pull request #12: feat: validate it (#12)",
    ]);
  });

  it("names a pull request only when the commit is that pull request's merge commit", () => {
    const pullsWithoutThisMerge = [
      [],
      [mergedPull({ merged: false, mergeCommitSha: null })],
      [mergedPull({ mergeCommitSha: DEVELOP_TIP })],
      [mergedPull({ merged: false, mergeCommitSha: MERGE })],
    ];
    for (const pulls of pullsWithoutThisMerge) {
      assert.deepEqual(
        carriedCommitLines([{ sha: MERGE, subject: "wip", pulls }], 1),
        [
          "The push event lists 1 commit(s):",
          "  2222222 no merged pull request: wip",
        ],
      );
    }
  });

  it("finds the merged pull request among the others GitHub lists for the commit", () => {
    const pulls = [mergedPull({ number: 6, merged: false }), mergedPull({})];
    assert.deepEqual(
      carriedCommitLines([{ sha: MERGE, subject: "feat: a (#7)", pulls }], 1),
      [
        "The push event lists 1 commit(s):",
        "  2222222 pull request #7: feat: a (#7)",
      ],
    );
  });

  it("says how many commits the event lists beyond the listed ones", () => {
    const listed = [{ sha: MERGE, subject: "chore: step 1", pulls: [] }];
    assert.deepEqual(carriedCommitLines(listed, 4), [
      "The push event lists 4 commit(s):",
      "  2222222 no merged pull request: chore: step 1",
      "  ... and 3 more",
    ]);
  });

  it("gives only the count when the event lists no commit", () => {
    assert.deepEqual(carriedCommitLines([], 0), [
      "The push event lists 0 commit(s):",
    ]);
  });
});

describe("carriedCommitLines: the subject it prints", () => {
  const PREFIX = "  2222222 no merged pull request: ";
  const ESCAPE = String.fromCharCode(0x1b);
  const lineOf = (subject) =>
    carriedCommitLines([{ sha: MERGE, subject, pulls: [] }], 1)[1];

  it("removes C0 controls, DEL and C1 controls, line breaks among them", () => {
    const controls = [
      0x00, 0x07, 0x09, 0x0a, 0x0d, 0x1f, 0x7f, 0x80, 0x9b, 0x9f,
    ]
      .map((code) => String.fromCharCode(code))
      .join("");
    assert.equal(
      lineOf(`fix: ${ESCAPE}[31mred${ESCAPE}[0m${controls} text`),
      `${PREFIX}fix: [31mred[0m text`,
    );
  });

  it("keeps the characters on either side of the control ranges", () => {
    const kept = [0x20, 0x7e, 0xa0, 0xa1]
      .map((code) => String.fromCharCode(code))
      .join("");
    assert.equal(lineOf(`a${kept}b`), `${PREFIX}a${kept}b`);
  });

  it("prints a subject of exactly 100 characters whole", () => {
    const subject = "x".repeat(100);
    assert.equal(lineOf(subject), `${PREFIX}${subject}`);
  });

  it("cuts a longer subject to 100 characters and ends the line with how many there were", () => {
    assert.equal(
      lineOf("x".repeat(101)),
      `${PREFIX}${"x".repeat(100)} [subject cut at 100 of 101 characters]`,
    );
    assert.equal(
      lineOf(`${"y".repeat(100)}${"z".repeat(63)}`),
      `${PREFIX}${"y".repeat(100)} [subject cut at 100 of 163 characters]`,
    );
  });

  it("counts the characters that are left once the control characters are gone", () => {
    const subject = `${ESCAPE.repeat(5)}${"x".repeat(100)}`;
    assert.equal(lineOf(subject), `${PREFIX}${"x".repeat(100)}`);
  });

  it("counts code points, so that the cut does not split one", () => {
    const astral = String.fromCodePoint(0x1f600);
    assert.equal(
      lineOf(`${"x".repeat(99)}${astral}tail`),
      `${PREFIX}${"x".repeat(99)}${astral} [subject cut at 100 of 104 characters]`,
    );
  });

  it("puts its own marker only after exactly 100 characters, which a subject that imitates the marker cannot have", () => {
    const imitation = " [subject cut at 100 of 163 characters]";
    const subject = `${"x".repeat(100 - imitation.length)}${imitation}`;
    assert.equal(lineOf(subject), `${PREFIX}${subject}`);
    assert.equal(
      lineOf(`x${subject}`),
      `${PREFIX}x${subject.slice(0, 99)} [subject cut at 100 of 101 characters]`,
    );
  });
});

describe("AFTER_SEVERAL_COMMITS", () => {
  it("says on one line that the push is reverted before the next release or accepted by the owner", () => {
    assert.equal(
      AFTER_SEVERAL_COMMITS,
      "What happens next: the push is reverted before the next release, " +
        "or the repository's owner checks its content and accepts it.",
    );
    assert.doesNotMatch(AFTER_SEVERAL_COMMITS, /\n/);
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
