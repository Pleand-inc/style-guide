export const USAGE = `Usage: style-guide <command>

Set a repository up
  init                  write the workflows, the agent skill and the husky hooks, and list what is left to do by hand
  check                 fail when what init writes is missing or differs, or a manual step is left

Branch flow
  check-commit          pre-commit hook: block a commit made on master or develop
  check-push            pre-push hook: block a push that the branch flow does not allow
  check-pull-request    CI: check a pull request's base and head (BASE_REF, HEAD_REF)
  check-landed-commit   CI: check that a push to master or develop is one merged pull request
  merge <pr-number>     merge a pull request the way the branch flow requires, through the gh CLI

Work branch prefixes and long-lived branches come from style-guide.config.json at the repository root, when present.
Exit status: 0 passed, 1 a check failed, 2 the command or the configuration cannot be used.`;
