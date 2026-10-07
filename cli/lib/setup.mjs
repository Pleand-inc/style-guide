// What a set-up repository holds, and how a repository's files compare with it (no I/O).

import {
  PACKAGE_NAME,
  pullRequestWorkflowFile,
  pushWorkflowFile,
  skillFile,
} from "./templates.mjs";
import { isRecord } from "./values.mjs";

/** @typedef {{ line: string, marker: string }} RequiredHookLine a hook has `line` when one of its lines holds `marker` */
/** @typedef {{ path: string, requiredLines: RequiredHookLine[] }} Hook */
/** @typedef {{ path: string, content: string }} FileToWrite */
/**
 * @typedef {object} OwnedFileStatus
 * @property {string} path
 * @property {string} content what this package version generates
 * @property {"missing" | "differs" | "current"} state
 */
/**
 * @typedef {object} HookStatus
 * @property {string} path
 * @property {string} content the file `init` creates when the hook is missing
 * @property {boolean} exists
 * @property {string[]} missingLines
 */
/**
 * @typedef {object} SetupInspection
 * @property {OwnedFileStatus[]} ownedFiles
 * @property {HookStatus[]} hooks
 * @property {string[]} manualSteps what `init` never changes: `package.json` and the Biome configuration
 */
/** @typedef {ReadonlyMap<string, string>} RepositoryFiles the text of each inspected path that exists */

export const PULL_REQUEST_WORKFLOW_PATH =
  ".github/workflows/style-guide-pull-request.yml";
export const PUSH_WORKFLOW_PATH = ".github/workflows/style-guide-push.yml";
export const SKILL_PATH = ".claude/skills/style-guide/SKILL.md";
export const PACKAGE_JSON_PATH = "package.json";
export const BIOME_CONFIG_PATHS = ["biome.json", "biome.jsonc"];

/** @type {Hook[]} */
export const HOOKS = [
  {
    path: ".husky/pre-commit",
    requiredLines: [
      {
        line: "node_modules/.bin/style-guide check-commit",
        marker: "style-guide check-commit",
      },
      {
        line: "node_modules/.bin/biome check --staged --no-errors-on-unmatched",
        marker: "biome check",
      },
    ],
  },
  {
    path: ".husky/pre-push",
    requiredLines: [
      {
        line: "node_modules/.bin/style-guide check-push",
        marker: "style-guide check-push",
      },
    ],
  },
];

export const INSPECTED_PATHS = [
  PULL_REQUEST_WORKFLOW_PATH,
  PUSH_WORKFLOW_PATH,
  SKILL_PATH,
  ...HOOKS.map((hook) => hook.path),
  PACKAGE_JSON_PATH,
  ...BIOME_CONFIG_PATHS,
];

const SHARED_BIOME_CONFIG = `${PACKAGE_NAME}/biome`;
const EXACT_VERSION =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const GIT_URL_SPEC = /^(?:git\+|git:\/\/|github:|gitlab:|bitbucket:|gist:)/;
const GITHUB_SHORTHAND_SPEC = /^[A-Za-z0-9][\w-]*\/[\w.-]+(?:#.+)?$/;
const RUNS_HUSKY = /\bhusky\b/;
const INIT_ACTION_BY_STATE = {
  missing: "created",
  differs: "rewritten",
  current: "unchanged",
};
const ACTION_COLUMN_WIDTH = 11;

/**
 * @param {readonly string[]} ruleFiles paths under the installed package's `rules/` directory
 * @returns {FileToWrite[]} the files `init` owns, as this package version generates them
 */
export function ownedFiles(ruleFiles) {
  return [
    { path: PULL_REQUEST_WORKFLOW_PATH, content: pullRequestWorkflowFile() },
    { path: PUSH_WORKFLOW_PATH, content: pushWorkflowFile() },
    { path: SKILL_PATH, content: skillFile(ruleFiles) },
  ];
}

/** @param {string} text */
function withUnixLineEndings(text) {
  return text.replaceAll("\r\n", "\n");
}

/**
 * @param {string} expected
 * @param {string | undefined} actual
 * @returns {OwnedFileStatus["state"]}
 */
function ownedFileState(expected, actual) {
  if (actual === undefined) return "missing";
  // A checkout that converts line endings still holds the generated file.
  return withUnixLineEndings(actual) === expected ? "current" : "differs";
}

/**
 * @param {readonly RequiredHookLine[]} requiredLines
 * @param {string} hookText
 * @returns {string[]} the required lines no line of the hook runs; a commented-out line runs nothing
 */
export function missingHookLines(requiredLines, hookText) {
  const activeLines = hookText
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"));
  return requiredLines
    .filter(({ marker }) => !activeLines.some((line) => line.includes(marker)))
    .map(({ line }) => line);
}

/**
 * @param {Hook} hook
 * @param {string | undefined} hookText
 * @returns {HookStatus}
 */
function hookStatus(hook, hookText) {
  const lines = hook.requiredLines.map(({ line }) => line);
  return {
    path: hook.path,
    content: `${lines.join("\n")}\n`,
    exists: hookText !== undefined,
    missingLines:
      hookText === undefined
        ? lines
        : missingHookLines(hook.requiredLines, hookText),
  };
}

/**
 * @param {string} spec a dependency spec from `package.json`
 * @returns {boolean} whether the spec names one version: an exact version or a git spec, not a range or a tag
 */
export function isPinnedSpec(spec) {
  return (
    EXACT_VERSION.test(spec) ||
    GIT_URL_SPEC.test(spec) ||
    GITHUB_SHORTHAND_SPEC.test(spec)
  );
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} key
 * @returns {Record<string, unknown>}
 */
function recordAt(manifest, key) {
  const value = manifest[key];
  return isRecord(value) ? value : {};
}

/**
 * @param {unknown} spec the package's entry in `devDependencies`
 * @returns {string | null}
 */
function pinStep(spec) {
  if (typeof spec !== "string") {
    return `${PACKAGE_JSON_PATH}: add ${PACKAGE_NAME} to devDependencies at an exact version`;
  }
  if (isPinnedSpec(spec)) return null;
  return `${PACKAGE_JSON_PATH}: pin ${PACKAGE_NAME} in devDependencies to an exact version or a git spec (found "${spec}")`;
}

/**
 * @param {string | undefined} packageJsonText
 * @returns {Record<string, unknown> | null}
 */
function parseManifest(packageJsonText) {
  if (packageJsonText === undefined) return null;
  try {
    const manifest = JSON.parse(packageJsonText);
    return isRecord(manifest) ? manifest : null;
  } catch {
    return null;
  }
}

/**
 * @param {string | undefined} packageJsonText the text of `package.json`, or undefined when there is none
 * @returns {string[]} what the repository owner still has to change in `package.json`
 */
export function packageManualSteps(packageJsonText) {
  const manifest = parseManifest(packageJsonText);
  if (manifest === null)
    return [
      `${PACKAGE_JSON_PATH}: add a package.json that holds a JSON object`,
    ];
  const devDependencies = recordAt(manifest, "devDependencies");
  const prepare = recordAt(manifest, "scripts").prepare;
  const steps = [];
  if (typeof devDependencies.husky !== "string")
    steps.push(`${PACKAGE_JSON_PATH}: add husky to devDependencies`);
  if (typeof prepare !== "string" || !RUNS_HUSKY.test(prepare)) {
    steps.push(
      `${PACKAGE_JSON_PATH}: add a prepare script that runs husky ("prepare": "husky")`,
    );
  }
  const pin = pinStep(devDependencies[PACKAGE_NAME]);
  if (pin !== null) steps.push(pin);
  return steps;
}

/**
 * @param {RepositoryFiles} repositoryFiles
 * @returns {string[]}
 */
function biomeManualSteps(repositoryFiles) {
  const extendsSharedConfig = BIOME_CONFIG_PATHS.some((path) =>
    repositoryFiles.get(path)?.includes(SHARED_BIOME_CONFIG),
  );
  if (extendsSharedConfig) return [];
  return [
    `biome.json: extend the shared configuration ("extends": ["${SHARED_BIOME_CONFIG}"])`,
  ];
}

/**
 * @param {RepositoryFiles} repositoryFiles
 * @param {readonly string[]} ruleFiles paths under the installed package's `rules/` directory
 * @returns {SetupInspection}
 */
export function inspectSetup(repositoryFiles, ruleFiles) {
  return {
    ownedFiles: ownedFiles(ruleFiles).map(({ path, content }) => ({
      path,
      content,
      state: ownedFileState(content, repositoryFiles.get(path)),
    })),
    hooks: HOOKS.map((hook) =>
      hookStatus(hook, repositoryFiles.get(hook.path)),
    ),
    manualSteps: packageManualSteps(
      repositoryFiles.get(PACKAGE_JSON_PATH),
    ).concat(biomeManualSteps(repositoryFiles)),
  };
}

/** @param {HookStatus} hook */
function hookInitAction(hook) {
  if (!hook.exists) return "created";
  if (hook.missingLines.length === 0) return "unchanged";
  return "incomplete";
}

/**
 * @param {HookStatus} hook
 * @returns {string[]} the lines to add by hand; `init` never edits a hook that already exists
 */
function hookManualSteps(hook) {
  if (!hook.exists) return [];
  return hook.missingLines.map(
    (line) => `add this line to ${hook.path}: ${line}`,
  );
}

/** @param {SetupInspection} inspection */
function allManualSteps(inspection) {
  return inspection.hooks
    .flatMap(hookManualSteps)
    .concat(inspection.manualSteps);
}

/**
 * @param {FileToWrite} status an owned file or a hook, with the content `init` writes for it
 * @returns {FileToWrite}
 */
function toFileToWrite({ path, content }) {
  return { path, content };
}

/**
 * @param {string} action
 * @param {string} path
 */
function fileLine(action, path) {
  return `${action.padEnd(ACTION_COLUMN_WIDTH)}${path}`;
}

/**
 * @param {SetupInspection} inspection
 * @returns {{ writes: FileToWrite[], lines: string[], exitCode: 0 | 1 }} what `init` writes and prints: one line
 *   per file, then one line per manual step
 */
export function initPlan(inspection) {
  const staleOwnedFiles = inspection.ownedFiles.filter(
    (file) => file.state !== "current",
  );
  const missingHooks = inspection.hooks.filter((hook) => !hook.exists);
  const manualSteps = allManualSteps(inspection);
  return {
    writes: [
      ...staleOwnedFiles.map(toFileToWrite),
      ...missingHooks.map(toFileToWrite),
    ],
    lines: [
      ...inspection.ownedFiles.map((file) =>
        fileLine(INIT_ACTION_BY_STATE[file.state], file.path),
      ),
      ...inspection.hooks.map((hook) =>
        fileLine(hookInitAction(hook), hook.path),
      ),
      ...manualSteps.map((step) => `manual: ${step}`),
    ],
    exitCode: manualSteps.length === 0 ? 0 : 1,
  };
}

/**
 * @param {SetupInspection} inspection
 * @returns {{ lines: string[], exitCode: 0 | 1 }} what `check` prints: one line per problem
 */
export function checkReport(inspection) {
  const staleOwnedFiles = inspection.ownedFiles.filter(
    (file) => file.state !== "current",
  );
  const missingHooks = inspection.hooks.filter((hook) => !hook.exists);
  const problems = [
    ...staleOwnedFiles.map(
      (file) => `${file.state}: ${file.path} (run style-guide init)`,
    ),
    ...missingHooks.map(
      (hook) => `missing: ${hook.path} (run style-guide init)`,
    ),
    ...allManualSteps(inspection).map((step) => `manual: ${step}`),
  ];
  if (problems.length === 0)
    return { lines: ["style-guide check: the setup is current"], exitCode: 0 };
  return { lines: problems, exitCode: 1 };
}
