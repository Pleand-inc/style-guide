# Security

Everything in this repository is public. Nothing secret may be committed here — not in files,
workflow logs, artifacts or commit messages.

## Credentials

The repository stores no secrets. The publish workflow publishes to npmjs.com with npm trusted
publishing: GitHub issues a short-lived OIDC token for the run (`id-token: write`), and npmjs.com
accepts it only from this repository's `publish.yml`.

## Repository settings

- Only repository collaborators (currently the organization admins) can push or open pull requests
  (`pull_request_creation_policy: collaborators_only`); there are no outside collaborators, deploy
  keys or webhooks. Issues, wiki, projects and discussions are off.
- Workflow runs from fork pull requests always need approval, and the default workflow token is
  read-only (the publish job alone gets `id-token: write`).
- Only GitHub-owned actions are allowed, and every `uses:` is pinned to a full commit SHA.
- `master` cannot be deleted or force-pushed (ruleset `protect-master`).
- Secret scanning and push protection are on.

## Reporting

Report a security problem privately through the repository's Security → Report a vulnerability
form (private vulnerability reporting is on). Only the repository administrators see the report.
