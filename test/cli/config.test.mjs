import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_BRANCH_FLOW,
  parseBranchFlowConfig,
} from "../../cli/lib/config.mjs";
import { ConfigError, UsageError } from "../../cli/lib/errors.mjs";

function parse(value) {
  return parseBranchFlowConfig(JSON.stringify(value));
}

const INVALID_FILES = [
  {
    name: "an unknown top-level key",
    value: { branchflow: {} },
    message: /unknown key 'branchflow'/,
  },
  {
    name: "a branchFlow that is an array",
    value: { branchFlow: [] },
    message: /'branchFlow' must be an object/,
  },
  {
    name: "a branchFlow that is a string",
    value: { branchFlow: "feat" },
    message: /'branchFlow' must be an object/,
  },
  {
    name: "an unknown key under branchFlow",
    value: { branchFlow: { prefixes: ["feat"] } },
    message: /unknown key 'branchFlow\.prefixes'/,
  },
  {
    name: "prefixes that are not an array",
    value: { branchFlow: { workBranchPrefixes: "feat" } },
    message: /'branchFlow\.workBranchPrefixes' must be an array of strings/,
  },
  {
    name: "an empty prefix list",
    value: { branchFlow: { workBranchPrefixes: [] } },
    message: /'branchFlow\.workBranchPrefixes' must list at least one prefix/,
  },
  {
    name: "a prefix that is a number",
    value: { branchFlow: { workBranchPrefixes: ["feat", 7] } },
    message: /'branchFlow\.workBranchPrefixes\[1\]' must be a string/,
  },
  {
    name: "an empty prefix",
    value: { branchFlow: { workBranchPrefixes: [""] } },
    message: /'branchFlow\.workBranchPrefixes\[0\]' must be a string/,
  },
  {
    name: "a prefix with a slash",
    value: { branchFlow: { workBranchPrefixes: ["feat/x"] } },
    message: /'branchFlow\.workBranchPrefixes\[0\]' must be a string/,
  },
  {
    name: "long-lived branches that are not an array",
    value: { branchFlow: { longLivedBranches: "staging" } },
    message: /'branchFlow\.longLivedBranches' must be an array of strings/,
  },
  {
    name: "a long-lived branch that is not a string",
    value: { branchFlow: { longLivedBranches: [null] } },
    message: /'branchFlow\.longLivedBranches\[0\]' must be a branch name/,
  },
  {
    name: "a long-lived branch with a space",
    value: { branchFlow: { longLivedBranches: ["staging", "my branch"] } },
    message: /'branchFlow\.longLivedBranches\[1\]' must be a branch name/,
  },
  {
    name: "master as a long-lived branch",
    value: { branchFlow: { longLivedBranches: ["master"] } },
    message: /'branchFlow\.longLivedBranches\[0\]' is 'master'/,
  },
  {
    name: "develop as a long-lived branch",
    value: { branchFlow: { longLivedBranches: ["develop"] } },
    message: /'branchFlow\.longLivedBranches\[0\]' is 'develop'/,
  },
  {
    name: "a long-lived branch that is a work branch name",
    value: {
      branchFlow: {
        workBranchPrefixes: ["ops"],
        longLivedBranches: ["ops/deploy"],
      },
    },
    message:
      /'branchFlow\.longLivedBranches\[0\]' is 'ops\/deploy', which is also a work branch name/,
  },
];

describe("the default branch flow", () => {
  it("has the four work branch prefixes and no long-lived branch", () => {
    assert.deepEqual(DEFAULT_BRANCH_FLOW, {
      workBranchPrefixes: ["feat", "fix", "chore", "docs"],
      longLivedBranches: [],
    });
  });
});

describe("parseBranchFlowConfig: what it reads", () => {
  it("returns the defaults for a file that sets nothing", () => {
    assert.deepEqual(parse({}), DEFAULT_BRANCH_FLOW);
    assert.deepEqual(parse({ branchFlow: {} }), DEFAULT_BRANCH_FLOW);
  });

  it("reads both lists", () => {
    const branchFlow = {
      workBranchPrefixes: ["feat", "fix", "ops"],
      longLivedBranches: ["staging"],
    };
    assert.deepEqual(parse({ branchFlow }), branchFlow);
  });

  it("keeps the default of the list the file leaves out", () => {
    assert.deepEqual(
      parse({ branchFlow: { longLivedBranches: ["staging"] } }),
      {
        workBranchPrefixes: DEFAULT_BRANCH_FLOW.workBranchPrefixes,
        longLivedBranches: ["staging"],
      },
    );
    assert.deepEqual(parse({ branchFlow: { workBranchPrefixes: ["task"] } }), {
      workBranchPrefixes: ["task"],
      longLivedBranches: [],
    });
  });
});

describe("parseBranchFlowConfig: what it rejects", () => {
  for (const { name, value, message } of INVALID_FILES) {
    it(`rejects ${name}, naming the key`, () => {
      assert.throws(
        () => parse(value),
        (error) => {
          assert.ok(error instanceof ConfigError);
          assert.match(error.message, /^style-guide\.config\.json: /);
          assert.match(error.message, message);
          assert.doesNotMatch(error.message, /\n/);
          return true;
        },
      );
    });
  }

  it("rejects text that is not JSON", () => {
    assert.throws(() => parseBranchFlowConfig("{ branchFlow: "), {
      name: "Error",
      message: /^style-guide\.config\.json: not valid JSON/,
    });
  });

  for (const text of ["[]", "null", '"feat"', "7"]) {
    it(`rejects the top-level value ${text}`, () => {
      assert.throws(
        () => parseBranchFlowConfig(text),
        /the top level must be an object/,
      );
    });
  }

  it("throws an error the command line maps to exit status 2", () => {
    assert.throws(
      () => parseBranchFlowConfig("[]"),
      (error) => error instanceof UsageError,
    );
  });
});
