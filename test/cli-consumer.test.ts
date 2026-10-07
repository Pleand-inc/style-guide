import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { devNull, tmpdir } from "node:os";
import { delimiter, dirname, join, sep } from "node:path";
import { after, test } from "node:test";
import { z } from "zod";

const repositoryRoot = process.cwd();
const workDirectory = mkdtempSync(join(tmpdir(), "style-guide-cli-consumer-"));
const consumerDirectory = join(workDirectory, "consumer");
const workflowRunnerDirectory = join(workDirectory, "workflow-runner");
const installedPackageDirectory = join(
  consumerDirectory,
  "node_modules",
  "@pleand-inc",
  "style-guide",
);
const installedBinary = join(
  consumerDirectory,
  "node_modules",
  ".bin",
  "style-guide",
);
const pullRequestWorkflowPath = join(
  ".github",
  "workflows",
  "style-guide-pull-request.yml",
);
const setupFiles = [
  ".github/workflows/style-guide-pull-request.yml",
  ".github/workflows/style-guide-push.yml",
  ".claude/skills/style-guide/SKILL.md",
  ".husky/pre-commit",
  ".husky/pre-push",
];
const installedRulePrefix = "- `node_modules/@pleand-inc/style-guide/rules/";

const manifestSchema = z.object({
  version: z.string(),
  bin: z.object({ "style-guide": z.string() }),
  dependencies: z.record(z.string(), z.string()).optional(),
});

// A surrounding git hook or CI run sets these, and the commands under test read them.
const droppedVariableName = /^(GIT_|GITHUB_|BASE_REF$|HEAD_REF$)/;
const childEnvironment = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !droppedVariableName.test(name),
    ),
  ),
  // The installed bin starts with `#!/usr/bin/env node`.
  PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH}`,
  GIT_CONFIG_GLOBAL: devNull,
  GIT_CONFIG_NOSYSTEM: "1",
};

const runInstalledCli = (
  commandArguments: string[],
  extraEnvironment: Record<string, string>,
) =>
  spawnSync(installedBinary, commandArguments, {
    cwd: consumerDirectory,
    env: { ...childEnvironment, ...extraEnvironment },
    encoding: "utf8",
  });

const gitIdentity = {
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

const runGit = (gitArguments: string[]) =>
  spawnSync("git", gitArguments, {
    cwd: consumerDirectory,
    env: { ...childEnvironment, ...gitIdentity },
    encoding: "utf8",
  });

const writeConsumerFile = (path: string, content: string) => {
  mkdirSync(dirname(join(consumerDirectory, path)), { recursive: true });
  writeFileSync(join(consumerDirectory, path), content);
};

const linesOf = (text: string) =>
  text.split("\n").filter((line) => line !== "");

const filesUnder = (directory: string) =>
  readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((path) => statSync(join(directory, path)).isFile())
    .map((path) => path.split(sep).join("/"))
    .sort();

// GitHub Actions runs a step's `run` lines with this shell and these flags.
const runAsWorkflowStep = (script: string, environment: NodeJS.ProcessEnv) =>
  spawnSync(
    "bash",
    ["--noprofile", "--norc", "-eo", "pipefail", "-c", script],
    { cwd: workflowRunnerDirectory, env: environment, encoding: "utf8" },
  );

execFileSync("npm", ["pack", "--pack-destination", workDirectory], {
  cwd: repositoryRoot,
});
const tarballName = readdirSync(workDirectory).find((name) =>
  name.endsWith(".tgz"),
);
assert.ok(tarballName, "npm pack wrote no tarball");
const tarballPath = join(workDirectory, tarballName);

// npm installs the tarball the way it installs the published package, so the bin link is npm's own.
// --legacy-peer-deps leaves the Biome peer dependency out: the hook test links this repository's Biome instead.
// --offline makes the install fail instead of reaching the registry.
mkdirSync(consumerDirectory);
writeFileSync(
  join(consumerDirectory, "package.json"),
  JSON.stringify({ name: "consumer", private: true }),
);
execFileSync(
  "npm",
  [
    "install",
    "--offline",
    "--legacy-peer-deps",
    "--no-audit",
    "--no-fund",
    tarballPath,
  ],
  { cwd: consumerDirectory, env: childEnvironment },
);
const installedManifest = manifestSchema.parse(
  JSON.parse(
    readFileSync(join(installedPackageDirectory, "package.json"), "utf8"),
  ),
);

// What a repository holds after following the README: exact versions, husky, and the shared Biome configuration.
writeFileSync(
  join(consumerDirectory, "package.json"),
  JSON.stringify({
    name: "consumer",
    private: true,
    scripts: { prepare: "husky" },
    devDependencies: {
      "@biomejs/biome": "2.5.15",
      "@pleand-inc/style-guide": installedManifest.version,
      husky: "9.1.7",
    },
  }),
);
writeFileSync(
  join(consumerDirectory, "biome.json"),
  JSON.stringify({ extends: ["@pleand-inc/style-guide/biome"] }),
);
execFileSync("git", ["init", "--quiet"], {
  cwd: consumerDirectory,
  env: childEnvironment,
});

after(() => rmSync(workDirectory, { recursive: true, force: true }));

test("the tarball ships the command line, the rules and the branch flow, and no test", () => {
  const shipped = filesUnder(installedPackageDirectory);
  for (const path of [
    "cli/style-guide.mjs",
    "rules/git/branch-flow/RULES.md",
    "rules/typescript/types/RULES.md",
  ]) {
    assert.ok(shipped.includes(path), `${path} is not in the tarball`);
  }
  assert.deepEqual(
    shipped.filter((path) => /(^|\/)test\/|\.test\./.test(path)),
    [],
  );
  assert.deepEqual(
    [...new Set(shipped.map((path) => path.split("/")[0]))].sort(),
    [
      "LICENSE",
      "README.md",
      "biome",
      "cli",
      "package.json",
      "rules",
      "tsconfig",
    ],
  );
});

test("the package declares the style-guide bin and no runtime dependency", () => {
  assert.equal(
    join(installedPackageDirectory, installedManifest.bin["style-guide"]),
    join(installedPackageDirectory, "cli", "style-guide.mjs"),
  );
  assert.equal(installedManifest.dependencies, undefined);
  assert.deepEqual(
    readdirSync(join(consumerDirectory, "node_modules")).sort(),
    [".bin", ".package-lock.json", "@pleand-inc"],
  );
});

test("npm links the bin, and it runs from the installed location", () => {
  assert.equal(existsSync(installedBinary), true);
  const help = runInstalledCli(["--help"], {});
  assert.equal(help.stderr, "");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^Usage: style-guide <command>/);

  const unknown = runInstalledCli(["no-such-command"], {});
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown command 'no-such-command'/);
});

test("the installed check-pull-request reads the base and head from the environment", () => {
  const followsTheFlow = runInstalledCli(["check-pull-request"], {
    BASE_REF: "develop",
    HEAD_REF: "feat/login",
  });
  assert.equal(followsTheFlow.status, 0);
  assert.equal(
    followsTheFlow.stdout,
    "style-guide check-pull-request: feat/login -> develop follows the flow\n",
  );

  const breaksTheFlow = runInstalledCli(["check-pull-request"], {
    BASE_REF: "master",
    HEAD_REF: "feat/login",
  });
  assert.equal(breaksTheFlow.status, 1);
  assert.match(breaksTheFlow.stderr, /master takes only develop/);
});

test("init sets the consumer up, check then passes, and check fails once a hook is deleted", () => {
  const beforeInit = runInstalledCli(["check"], {});
  assert.equal(beforeInit.status, 1);
  assert.equal(linesOf(beforeInit.stderr).length, setupFiles.length);

  const init = runInstalledCli(["init"], {});
  assert.equal(init.stderr, "");
  assert.deepEqual(
    linesOf(init.stdout),
    setupFiles.map((path) => `created    ${path}`),
  );
  assert.equal(init.status, 0);

  const check = runInstalledCli(["check"], {});
  assert.equal(check.stdout, "style-guide check: the setup is current\n");
  assert.equal(check.status, 0);

  const secondInit = runInstalledCli(["init"], {});
  assert.deepEqual(
    linesOf(secondInit.stdout),
    setupFiles.map((path) => `unchanged  ${path}`),
  );

  rmSync(join(consumerDirectory, ".husky", "pre-push"));
  const afterDelete = runInstalledCli(["check"], {});
  assert.equal(afterDelete.status, 1);
  assert.equal(
    afterDelete.stderr,
    "missing: .husky/pre-push (run style-guide init)\n",
  );
  assert.equal(runInstalledCli(["init"], {}).status, 0);
});

test("the generated skill lists the rule files the installed package holds", () => {
  const skill = readFileSync(
    join(consumerDirectory, ".claude", "skills", "style-guide", "SKILL.md"),
    "utf8",
  );
  const listed = linesOf(skill)
    .filter((line) => line.startsWith(installedRulePrefix))
    .map((line) => line.slice(installedRulePrefix.length, -1));
  assert.deepEqual(
    listed,
    filesUnder(join(installedPackageDirectory, "rules")),
  );
  assert.ok(listed.includes("typescript/types/RULES.md"));
  for (const path of listed) {
    assert.equal(
      existsSync(join(installedPackageDirectory, "rules", path)),
      true,
    );
  }
  assert.equal(
    existsSync(
      join(installedPackageDirectory, "rules", "git", "branch-flow", "RULES.md"),
    ),
    true,
  );
});

test("the generated workflow step runs the command from the spec package.json pins, without node_modules", () => {
  const workflow = readFileSync(
    join(consumerDirectory, pullRequestWorkflowPath),
    "utf8",
  );
  const runLines = workflow
    .split("\n")
    .filter((line) => /^ {10}(spec=|npm exec )/.test(line))
    .map((line) => line.trim());
  const [readPinnedSpec, runPairingCheck] = runLines;
  assert.ok(readPinnedSpec && runPairingCheck);
  assert.match(runPairingCheck, /-- style-guide check-pull-request$/);

  mkdirSync(workflowRunnerDirectory);
  const writeRunnerManifest = (spec: string) =>
    writeFileSync(
      join(workflowRunnerDirectory, "package.json"),
      JSON.stringify({ devDependencies: { "@pleand-inc/style-guide": spec } }),
    );
  const stepEnvironment = {
    ...childEnvironment,
    NPM_CONFIG_LEGACY_PEER_DEPS: "true",
    // An empty cache of its own and no network: the step reaches nothing but the spec it is given.
    npm_config_cache: join(workDirectory, "npm-cache"),
    npm_config_offline: "true",
    npm_config_update_notifier: "false",
  };

  writeRunnerManifest("1.2.3");
  const exactVersion = runAsWorkflowStep(
    `${readPinnedSpec}\nprintf %s "$spec"`,
    stepEnvironment,
  );
  assert.equal(exactVersion.stdout, "@pleand-inc/style-guide@1.2.3");

  // A version that is not published cannot come from the registry, so the step runs from the tarball's path.
  // npm reads that spec the way it reads a git spec: as given, with no package name in front.
  writeRunnerManifest(tarballPath);
  const script = `${readPinnedSpec}\n${runPairingCheck}`;
  const followsTheFlow = runAsWorkflowStep(script, {
    ...stepEnvironment,
    BASE_REF: "develop",
    HEAD_REF: "feat/login",
  });
  assert.equal(followsTheFlow.status, 0, followsTheFlow.stderr);
  assert.match(
    followsTheFlow.stdout,
    /feat\/login -> develop follows the flow/,
  );

  const breaksTheFlow = runAsWorkflowStep(script, {
    ...stepEnvironment,
    BASE_REF: "master",
    HEAD_REF: "feat/login",
  });
  assert.equal(breaksTheFlow.status, 1);
  assert.match(breaksTheFlow.stderr, /master takes only develop/);
  assert.equal(
    existsSync(join(workflowRunnerDirectory, "node_modules")),
    false,
  );
});

test("git runs the generated hooks: a commit on master, a commit that breaks a rule and a push to develop are refused", () => {
  assert.equal(runInstalledCli(["init"], {}).status, 0);
  // husky runs each file under .husky with `sh -e`. These runners do the same, so the test installs no husky.
  for (const hook of ["pre-commit", "pre-push"]) {
    writeFileSync(
      join(consumerDirectory, ".git", "hooks", hook),
      `#!/bin/sh\nexec sh -e .husky/${hook} "$@"\n`,
      { mode: 0o755 },
    );
  }
  symlinkSync(
    realpathSync(join(repositoryRoot, "node_modules", ".bin", "biome")),
    join(consumerDirectory, "node_modules", ".bin", "biome"),
  );
  writeConsumerFile(".gitignore", "node_modules/\n");
  writeConsumerFile("src/greeting.ts", 'export const greeting = "hello";\n');
  writeConsumerFile("src/level.ts", "export enum Level {\n  Low,\n}\n");

  runGit(["symbolic-ref", "HEAD", "refs/heads/master"]);
  runGit(["add", "src/greeting.ts"]);
  const onMaster = runGit(["commit", "-m", "feat: add the greeting"]);
  assert.equal(onMaster.status, 1);
  assert.match(
    onMaster.stderr,
    /style-guide check-commit: commit on 'master' is blocked/,
  );

  runGit(["symbolic-ref", "HEAD", "refs/heads/feat/greeting"]);
  runGit(["add", "src/level.ts"]);
  const breaksARule = runGit(["commit", "-m", "feat: add the level"]);
  assert.equal(breaksARule.status, 1);
  assert.match(breaksARule.stdout + breaksARule.stderr, /lint\/style\/noEnum/);

  runGit(["rm", "--quiet", "--cached", "src/level.ts"]);
  const conforming = runGit(["commit", "-m", "feat: add the greeting"]);
  assert.equal(conforming.status, 0, conforming.stdout + conforming.stderr);

  const remoteDirectory = join(workDirectory, "remote.git");
  execFileSync("git", ["init", "--quiet", "--bare", remoteDirectory], {
    env: childEnvironment,
  });
  runGit(["remote", "add", "origin", remoteDirectory]);
  const workBranch = runGit(["push", "origin", "feat/greeting"]);
  assert.equal(workBranch.status, 0, workBranch.stderr);

  const toDevelop = runGit(["push", "origin", "feat/greeting:develop"]);
  assert.equal(toDevelop.status, 1);
  assert.match(
    toDevelop.stderr,
    /style-guide check-push: direct push to 'develop' is blocked/,
  );
  const outsideTheFlow = runGit(["push", "origin", "feat/greeting:wip"]);
  assert.equal(outsideTheFlow.status, 1);
  assert.match(outsideTheFlow.stderr, /push to 'wip' is blocked/);

  const remoteBranches = runGit(["ls-remote", "--heads", "origin"]);
  assert.match(remoteBranches.stdout, /^\S+\trefs\/heads\/feat\/greeting\n$/);
});
