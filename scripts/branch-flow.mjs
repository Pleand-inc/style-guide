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

/**
 * The `gh` invocations that carry out a merge decision, in order: the first merges, any later one cleans up after it.
 * @param {{ number: string, repo: string, title: string, headRef: string, inStack: boolean }} pr
 * @param {{ method: "squash" | "merge", deleteBranch: boolean }} decision a decideMerge result that was not refused
 * @returns {string[][] | { refused: string }} argument lists for `gh`
 */
export function mergeCommands({ number, repo, title, headRef, inStack }, { method, deleteBranch }) {
  if (!inStack) {
    const merge = ["pr", "merge", number, "--repo", repo, `--${method}`];
    if (deleteBranch) merge.push("--delete-branch");
    // A squash keeps GitHub's default message; a merge commit would otherwise read "Merge pull request #<n> from …".
    if (method === "merge") merge.push("--subject", `${title} (#${number})`);
    return [merge];
  }
  // A pull request in a stack refuses `gh pr merge`; it merges only through `gh stack merge`, which has no --subject.
  if (method === "merge") {
    return {
      refused:
        "is in a stack: the flow has no stacked pull requests into master, " +
        "and gh stack merge cannot set the merge commit's subject",
    };
  }
  const commands = [["stack", "merge", number, `--${method}`, "--yes"]];
  // `gh stack merge` leaves the merged branch in place. Each path segment is encoded: a `#` left as is would end the
  // path there and delete a different branch.
  const ref = headRef.split("/").map(encodeURIComponent).join("/");
  if (deleteBranch) commands.push(["api", "-X", "DELETE", `repos/${repo}/git/refs/heads/${ref}`]);
  return commands;
}
