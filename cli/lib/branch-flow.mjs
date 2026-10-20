// Branch-flow rules as pure functions (no I/O).
//
// Flow: push `<prefix>/<slug>` -> pull request into `develop` (squash, or a rebase from GitHub's merge button)
// -> pull request `develop` -> `master` (merge commit).

/** @typedef {import("./config.mjs").BranchFlow} BranchFlow */
/** @typedef {{ base: string, head: string }} PullRequestPair */
/** @typedef {{ method: "squash" | "merge", deleteBranch: boolean }} MergeDecision */
/** @typedef {{ refused: string }} Refusal */
/**
 * @typedef {object} MergeRequest
 * @property {string} number
 * @property {string} repo `owner/repository`
 * @property {string} title
 * @property {string} headRef
 * @property {boolean} inStack
 */
/**
 * @typedef {object} MergeCandidate a pull request as `gh` reports it before the merge
 * @property {string} number
 * @property {string} repo `owner/repository`
 * @property {string} base
 * @property {string} head
 * @property {string} state `OPEN`, `CLOSED` or `MERGED`
 * @property {boolean} isDraft
 * @property {string} title
 * @property {boolean} inStack
 */
/**
 * @typedef {object} LandedPull
 * @property {number} number
 * @property {string} base
 * @property {string} head
 * @property {string | null} mergeCommitSha
 * @property {boolean} merged
 */
/**
 * @typedef {object} CommitIdentity what a rebase keeps of a commit
 * @property {string} message
 * @property {string} authorName
 * @property {string} authorEmail
 */
/**
 * @typedef {{ sha: string, parents: string[] } & CommitIdentity} WalkedCommit a commit on the first-parent walk down
 *   from the tip of a push
 */
/**
 * @typedef {object} RebasedPull what `GET /repos/{owner}/{repo}/pulls/{number}` says of the pull request
 *   rebaseMergeCandidate names
 * @property {number} number
 * @property {number} commits how many commits the pull request has
 * @property {string} headSha the pull request's `head.sha`
 * @property {boolean} stacked whether the response names a GitHub stack (`stack`) for the pull request
 */
/**
 * @typedef {object} RebaseWalk what tells whether a push that moved develop by several commits is the rebase merge of
 *   the pull request rebaseMergeCandidate names
 * @property {RebasedPull} pull
 * @property {CommitIdentity[]} pullCommits the pull request's commits as `GET /repos/{owner}/{repo}/pulls/{number}/commits`
 *   lists them, the oldest first
 * @property {WalkedCommit[]} firstParents the commits on the first-parent walk down from the tip, the tip first, as far
 *   as nextCommitToWalk led
 */
/**
 * @typedef {object} LandedCommit
 * @property {"master" | "develop"} branch
 * @property {string} before the branch tip before the push; all zeros when the push created the branch
 * @property {boolean} forced
 * @property {{ sha: string, parents: string[] }} commit the branch tip after the push
 * @property {LandedPull[]} pulls the pull requests GitHub associates with that commit
 * @property {RebaseWalk} [rebaseWalk] read only for a push for which rebaseMergeCandidate names a pull request
 */
/**
 * @typedef {object} PushedCommit a commit the push event lists
 * @property {string} sha
 * @property {string} subject the first line of the commit message
 */
/**
 * @typedef {PushedCommit & { pulls: LandedPull[] }} CarriedCommit a pushed commit with the pull requests GitHub
 *   associates with it
 */

export const PROTECTED_BRANCHES = Object.freeze(["master", "develop"]);
export const LISTED_COMMIT_LIMIT = 20;
// The walk asks GitHub for each commit of the pull request, and a GITHUB_TOKEN may make 1,000 requests an hour in a
// repository. At this many commits `GET /repos/{owner}/{repo}/pulls/{number}/commits` also fits on one page.
export const REBASE_MERGE_COMMIT_LIMIT = 100;
export const AFTER_SEVERAL_COMMITS =
  "What happens next: the push is reverted before the next release, " +
  "or the repository's owner checks its content and accepts it.";

const HEADS = "refs/heads/";
const TAGS = "refs/tags/";
const ALL_ZEROS = /^0+$/;
const SHORT_SHA_LENGTH = 7;
const PRINTED_SUBJECT_LIMIT = 100;
// The general category Cc: the C0 controls U+0000 to U+001F, DEL U+007F and the C1 controls U+0080 to U+009F.
const CONTROL_CHARACTERS = /\p{Cc}/gu;
const PARENT_COUNT_BY_BRANCH = { master: 2, develop: 1 };
const MERGE_KIND_BY_BRANCH = {
  master: "merge commits",
  develop: "squash commits or rebased commits",
};

/** @param {string} name */
export function isProtectedBranch(name) {
  return PROTECTED_BRANCHES.includes(name);
}

/**
 * @param {string} name
 * @param {readonly string[]} workBranchPrefixes
 */
export function isWorkBranch(name, workBranchPrefixes) {
  return workBranchPrefixes.some(
    (prefix) =>
      name.startsWith(`${prefix}/`) && name.length > prefix.length + 1,
  );
}

/** @param {BranchFlow} branchFlow */
export function workBranchHint(branchFlow) {
  return `${branchFlow.workBranchPrefixes.join("|")}/<slug>`;
}

/**
 * @param {BranchFlow} branchFlow
 * @returns {string} how a change reaches a protected branch, to finish the sentence "Commit on …" or "Push …"
 */
export function pullRequestRoute(branchFlow) {
  return `a ${workBranchHint(branchFlow)} branch, open a pull request, then run: style-guide merge <number>`;
}

/**
 * @param {string} branch the checked-out branch; empty on a detached HEAD
 * @param {BranchFlow} branchFlow
 * @returns {string | null} why a commit here breaks the flow, or null
 */
export function commitProblem(branch, branchFlow) {
  if (!isProtectedBranch(branch)) return null;
  return (
    `commit on '${branch}' is blocked: '${branch}' changes only through a pull request. ` +
    `Commit on ${pullRequestRoute(branchFlow)}`
  );
}

/** @param {BranchFlow} branchFlow */
function pushableBranchHint(branchFlow) {
  const hint = workBranchHint(branchFlow);
  if (branchFlow.longLivedBranches.length === 0) return hint;
  return `${hint} or one of ${branchFlow.longLivedBranches.join(", ")}`;
}

/**
 * @param {string} remoteRef full ref being updated on the remote, e.g. `refs/heads/feat/x`
 * @param {string} localSha sha being pushed; all zeros means the remote ref is being deleted
 * @param {BranchFlow} branchFlow
 * @returns {{ allowed: boolean, reason: string }}
 */
export function classifyPushTarget(remoteRef, localSha, branchFlow) {
  const verb = ALL_ZEROS.test(localSha) ? "delete of" : "push to";
  if (remoteRef.startsWith(TAGS) && remoteRef.length > TAGS.length) {
    return { allowed: true, reason: `${verb} a tag` };
  }
  if (!remoteRef.startsWith(HEADS)) {
    return {
      allowed: false,
      reason: `${verb} '${remoteRef}' is blocked: not a branch or a tag`,
    };
  }
  const branch = remoteRef.slice(HEADS.length);
  if (isProtectedBranch(branch)) {
    return {
      allowed: false,
      reason: `direct ${verb} '${branch}' is blocked: '${branch}' changes only through a pull request`,
    };
  }
  if (
    isWorkBranch(branch, branchFlow.workBranchPrefixes) ||
    branchFlow.longLivedBranches.includes(branch)
  ) {
    return { allowed: true, reason: `${verb} '${branch}'` };
  }
  return {
    allowed: false,
    reason: `${verb} '${branch}' is blocked: branch names must be ${pushableBranchHint(branchFlow)}`,
  };
}

/**
 * @param {string} prePushInput what git writes to a pre-push hook's stdin: one line per pushed ref,
 *   `<local ref> <local sha> <remote ref> <remote sha>`
 * @param {BranchFlow} branchFlow
 * @returns {string[]} one problem per ref the flow blocks
 */
export function pushProblems(prePushInput, branchFlow) {
  const problems = [];
  for (const line of prePushInput.split("\n")) {
    if (line.trim() === "") continue;
    const [, localSha = "", remoteRef = ""] = line.trim().split(/\s+/);
    const { allowed, reason } = classifyPushTarget(
      remoteRef,
      localSha,
      branchFlow,
    );
    if (!allowed)
      problems.push(`${reason}. Push ${pullRequestRoute(branchFlow)}`);
  }
  return problems;
}

/**
 * @param {PullRequestPair} pair base and head branch names of a pull request
 * @param {BranchFlow} branchFlow
 * @returns {MergeDecision | Refusal}
 */
export function decideMerge({ base, head }, branchFlow) {
  if (base === "develop") {
    if (isWorkBranch(head, branchFlow.workBranchPrefixes))
      return { method: "squash", deleteBranch: true };
    return {
      refused: `'${head}' cannot merge into develop: the head must be ${workBranchHint(branchFlow)}`,
    };
  }
  if (base === "master") {
    if (head === "develop") return { method: "merge", deleteBranch: false };
    return {
      refused: `'${head}' cannot merge into master: master takes only develop`,
    };
  }
  return {
    refused: `base '${base}' is not part of the flow: a pull request merges into develop or master`,
  };
}

/**
 * The `gh` invocations that carry out a merge decision, in order: the first merges, any later one cleans up after it.
 * @param {MergeRequest} request
 * @param {MergeDecision} decision a decideMerge result that was not refused
 * @returns {string[][] | Refusal} argument lists for `gh`
 */
export function mergeCommands(
  { number, repo, title, headRef, inStack },
  { method, deleteBranch },
) {
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
  if (deleteBranch)
    commands.push([
      "api",
      "-X",
      "DELETE",
      `repos/${repo}/git/refs/heads/${ref}`,
    ]);
  return commands;
}

/**
 * @param {MergeCandidate} candidate
 * @param {BranchFlow} branchFlow
 * @returns {string[][] | Refusal} the `gh` argument lists that merge the pull request, or why it is not merged;
 *   a refusal reads as the rest of a sentence that starts with the pull request's number
 */
export function planMerge(candidate, branchFlow) {
  if (candidate.state !== "OPEN")
    return { refused: `is ${candidate.state}, not OPEN` };
  if (candidate.isDraft)
    return { refused: "is a draft: mark it ready for review first" };
  const decision = decideMerge(candidate, branchFlow);
  if ("refused" in decision) return decision;
  const request = {
    number: candidate.number,
    repo: candidate.repo,
    title: candidate.title,
    headRef: candidate.head,
    inStack: candidate.inStack,
  };
  return mergeCommands(request, decision);
}

/**
 * The pairings a pull request may have: a work branch into develop, develop into master, or a work branch into the
 * work branch below it in a stack.
 * @param {PullRequestPair} pair
 * @param {BranchFlow} branchFlow
 * @returns {string | null} why the pairing is outside the flow, or null
 */
export function pullRequestPairProblem({ base, head }, branchFlow) {
  if (base === "master") {
    if (head === "develop") return null;
    return `'${head}' targets master: master takes only develop`;
  }
  const prefixes = branchFlow.workBranchPrefixes;
  if (!isWorkBranch(head, prefixes))
    return `the head '${head}' must be ${workBranchHint(branchFlow)}`;
  if (base === "develop" || isWorkBranch(base, prefixes)) return null;
  return (
    `base '${base}' is not part of the flow: ` +
    "a pull request targets develop, master, or the branch below it in a stack"
  );
}

/**
 * @param {string} sha
 * @param {LandedPull[]} pulls the pull requests GitHub associates with the commit
 * @returns {LandedPull | undefined} the merged pull request whose merge commit the commit is
 */
function mergedPullOf(sha, pulls) {
  return pulls.find(
    (candidate) => candidate.merged && candidate.mergeCommitSha === sha,
  );
}

/**
 * @param {Pick<LandedCommit, "before" | "forced" | "commit">} landed
 * @returns {boolean} whether the push, neither forced nor the creation of the branch, moved the branch by more than
 *   one first-parent commit; landedCommitProblem gives that reason exactly then, unless the push is the rebase merge
 *   of one pull request into develop
 */
export function carriedSeveralCommits({ before, forced, commit }) {
  return !forced && !ALL_ZEROS.test(before) && commit.parents[0] !== before;
}

/**
 * The pull request a push that moved develop by several commits can be the rebase merge of: the merged pull request
 * into develop, paired as the flow allows, whose `merge_commit_sha` is the tip. For a rebase merge GitHub records the
 * commit the base branch moved to as the pull request's `merge_commit_sha`.
 * @param {LandedCommit} landed
 * @param {BranchFlow} branchFlow
 * @returns {LandedPull | undefined} that pull request, or undefined when the push cannot be a rebase merge
 */
export function rebaseMergeCandidate(landed, branchFlow) {
  if (landed.branch !== "develop" || !carriedSeveralCommits(landed))
    return undefined;
  const pull = mergedPullOf(landed.commit.sha, landed.pulls);
  if (pull === undefined || pull.base !== "develop") return undefined;
  if (pullRequestPairProblem(pull, branchFlow) !== null) return undefined;
  return pull;
}

/**
 * Decides from the pull request alone, before its commits are listed or any commit below the tip is read. A rebase
 * merge on GitHub always writes new commits, so its tip is never the pull request's head; it moves the branch by one
 * first-parent commit per commit of the pull request, so a push of several commits needs at least two. A pull request
 * in a GitHub stack is never taken: "Merge stack" with the rebase method lands the commits of every layer in one push,
 * and whether the walk tells that push from the rebase merge of one pull request depends on what GitHub records for
 * the top pull request after the merge, which its documentation does not say.
 * @param {RebasedPull} pull
 * @param {string} tipSha the branch tip after the push
 * @returns {boolean} whether the push can be the rebase merge of the pull request and the check walks it
 */
export function canBeRebaseMergeOf({ commits, headSha, stacked }, tipSha) {
  return (
    !stacked &&
    commits >= 2 &&
    commits <= REBASE_MERGE_COMMIT_LIMIT &&
    headSha !== tipSha
  );
}

/**
 * @param {RebasedPull} pull
 * @returns {string | null} the line that says the check did not walk the push because the pull request has more than
 *   REBASE_MERGE_COMMIT_LIMIT commits, or null
 */
export function unwalkedRebaseMergeLine({ number, commits }) {
  if (commits <= REBASE_MERGE_COMMIT_LIMIT) return null;
  return (
    `Whether the push is the rebase merge of #${number} was not checked: #${number} has ${commits} commits, ` +
    `and a pull request with more than ${REBASE_MERGE_COMMIT_LIMIT} commits is squashed, not rebased`
  );
}

/**
 * @param {CommitIdentity} walked
 * @param {CommitIdentity} original
 */
function sameIdentity(walked, original) {
  return (
    walked.message === original.message &&
    walked.authorName === original.authorName &&
    walked.authorEmail === original.authorEmail
  );
}

/**
 * A rebase merge puts each commit of the pull request onto the branch as a new commit with one parent and the same
 * message and author. The squash commits of a stack landed by one push carry their own pull requests' titles instead.
 * @param {RebaseWalk} rebaseWalk
 * @param {number} depth 0 for the tip
 * @returns {boolean} whether the commit at that depth of the walk can be the pull request's commit as many places
 *   before its last one, rebased
 */
function rebasedAt({ pullCommits, firstParents }, depth) {
  const walked = firstParents[depth];
  const original = pullCommits[pullCommits.length - 1 - depth];
  return (
    walked !== undefined &&
    original !== undefined &&
    walked.parents.length === 1 &&
    sameIdentity(walked, original)
  );
}

/**
 * @param {RebaseWalk} rebaseWalk the commits read so far
 * @param {string} before the branch tip before the push
 * @returns {string | null} the commit to read next on the walk, or null when the commits read so far decide: the walk
 *   has as many commits as the pull request, or reached before, or met a commit that rules out a rebase merge
 */
export function nextCommitToWalk(rebaseWalk, before) {
  const { pull, firstParents } = rebaseWalk;
  const depth = firstParents.length - 1;
  const last = firstParents[depth];
  if (last === undefined || firstParents.length >= pull.commits) return null;
  if (!rebasedAt(rebaseWalk, depth) || last.parents[0] === before) return null;
  return last.parents[0] ?? null;
}

/**
 * @param {LandedCommit} landed a push for which carriedSeveralCommits is true
 * @param {BranchFlow} branchFlow
 * @returns {boolean} whether the push is the rebase merge of the pull request rebaseMergeCandidate names: the check
 *   walks that pull request, GitHub lists as many commits for it as it counts, and from the tip the walk takes exactly
 *   that many first-parent steps to reach before, each commit on it having one parent and the message and author of
 *   the pull request's commit at the same place
 */
function isRebaseMerge(landed, branchFlow) {
  const { rebaseWalk, commit, before } = landed;
  if (rebaseWalk === undefined) return false;
  if (rebaseMergeCandidate(landed, branchFlow) === undefined) return false;
  const { pull, pullCommits, firstParents } = rebaseWalk;
  return (
    canBeRebaseMergeOf(pull, commit.sha) &&
    pullCommits.length === pull.commits &&
    firstParents.length === pull.commits &&
    firstParents[0]?.sha === commit.sha &&
    firstParents.every(
      (walked, depth) =>
        rebasedAt(rebaseWalk, depth) &&
        walked.parents[0] === (firstParents[depth + 1]?.sha ?? before),
    )
  );
}

/**
 * Whoever pushed wrote the subject, and the line goes to a CI log: the subject is printed without control characters
 * and cut to PRINTED_SUBJECT_LIMIT code points. Only a cut puts the marker after exactly that many characters: a
 * subject printed whole is no longer than that in all, so words in it that look like the marker follow fewer.
 * @param {string} subject
 * @returns {string}
 */
function printedSubject(subject) {
  const characters = Array.from(subject.replace(CONTROL_CHARACTERS, ""));
  if (characters.length <= PRINTED_SUBJECT_LIMIT) return characters.join("");
  const kept = characters.slice(0, PRINTED_SUBJECT_LIMIT).join("");
  return `${kept} [subject cut at ${PRINTED_SUBJECT_LIMIT} of ${characters.length} characters]`;
}

/** @param {CarriedCommit} carried */
function carriedCommitLine({ sha, subject, pulls }) {
  const pull = mergedPullOf(sha, pulls);
  const origin =
    pull === undefined
      ? "no merged pull request"
      : `pull request #${pull.number}`;
  return `  ${sha.slice(0, SHORT_SHA_LENGTH)} ${origin}: ${printedSubject(subject)}`;
}

/**
 * What the check prints under the problem of a push for which carriedSeveralCommits is true. A commit is named with
 * a pull request only when it is that merged pull request's merge commit.
 * @param {CarriedCommit[]} listed the first commits the push event lists, at most LISTED_COMMIT_LIMIT
 * @param {number} total how many commits the push event lists
 * @returns {string[]} a line that counts the commits, a line for each listed one, and a line that counts the rest
 */
export function carriedCommitLines(listed, total) {
  const lines = [`The push event lists ${total} commit(s):`];
  lines.push(...listed.map(carriedCommitLine));
  if (total > listed.length)
    lines.push(`  ... and ${total - listed.length} more`);
  return lines;
}

/**
 * Checks what a push left at the tip of master or develop. Merging a pull request moves the branch by exactly one
 * first-parent commit, the pull request's `merge_commit_sha`, except that a rebase merge into develop moves it by the
 * pull request's commits, so anything else did not come through a pull request.
 * @param {LandedCommit} landed
 * @param {BranchFlow} branchFlow
 * @returns {string | null} why the push breaks the flow, or null
 */
export function landedCommitProblem(landed, branchFlow) {
  const { branch, before, forced, commit, pulls } = landed;
  if (forced) return `${branch} was force-pushed to ${commit.sha}`;
  if (ALL_ZEROS.test(before))
    return `${branch} was created at ${commit.sha}, not moved by a pull request`;
  if (carriedSeveralCommits(landed)) {
    if (isRebaseMerge(landed, branchFlow)) return null;
    return `${branch} moved from ${before} to ${commit.sha} by more than one first-parent commit`;
  }
  const pull = mergedPullOf(commit.sha, pulls);
  if (pull === undefined)
    return `${commit.sha} on ${branch} did not come from a merged pull request`;
  if (pull.base !== branch)
    return `#${pull.number} targeted ${pull.base}, not ${branch}`;
  const pairing = pullRequestPairProblem(pull, branchFlow);
  if (pairing !== null) return `#${pull.number}: ${pairing}`;
  if (commit.parents.length === PARENT_COUNT_BY_BRANCH[branch]) return null;
  return (
    `#${pull.number} landed on ${branch} as a commit with ${commit.parents.length} parent(s): ` +
    `${branch} takes ${MERGE_KIND_BY_BRANCH[branch]}`
  );
}
