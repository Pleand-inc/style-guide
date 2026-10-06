// Branch-flow rules as pure functions (no I/O). Caller: scripts/pr-merge.mjs.
//
// Flow: push `<prefix>/<slug>` -> PR into `develop` (squash) -> PR `develop` -> `master` (merge commit).

const PROTECTED_BRANCHES = ["master", "develop"];
const WORK_BRANCH = /^(feat|fix|chore|docs)\/.+$/;
const PREFIX_HINT = "feat|fix|chore|docs/<slug>";

export function isProtectedBranch(name) {
  return PROTECTED_BRANCHES.includes(name);
}

/**
 * @param {{ base: string, head: string }} pr base and head branch names of a pull request
 * @returns {{ method: "squash" | "merge", deleteBranch: boolean } | { refused: string }}
 */
export function decideMerge({ base, head }) {
  if (base === "develop") {
    if (WORK_BRANCH.test(head)) return { method: "squash", deleteBranch: true };
    return { refused: `'${head}' cannot merge into develop: the head must be ${PREFIX_HINT}` };
  }
  if (base === "master") {
    if (head === "develop") return { method: "merge", deleteBranch: false };
    return { refused: `'${head}' cannot merge into master: master takes only develop` };
  }
  return { refused: `base '${base}' is not part of the flow: a pull request targets develop or master` };
}
