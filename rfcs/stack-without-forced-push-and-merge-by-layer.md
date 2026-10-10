# 스택은 강제 push 없이 만들고 고치며, 한 층씩 머지합니다

## 바꾸는 것

`rules/git/branch-flow/RULES.md` 의 "스택 pull request" 절에서 항목 셋을 고쳐 씁니다.

스택을 만드는 항목입니다.

- 지금: `gh stack init --base develop <첫 브랜치>` 로 시작하고, `gh stack add <브랜치>` 로 층을 더하고, `gh stack submit --auto` 로 push 와 pull request 생성을 한 번에 합니다.
- 이 RFC 뒤: 층마다 작업 브랜치를 하나 두고 `git push` 로 올립니다. pull request 는 `gh pr create --draft` 로 열고, 위 층의 pull request 는 바로 아래 층의 브랜치를 base 로 둡니다. 그다음 `gh stack link --base develop <맨 아래부터 맨 위까지의 번호>` 로 pull request 들을 스택으로 묶습니다. 이미 열려 있는 pull request 도 같은 명령으로 묶습니다. `gh stack init`, `gh stack add`, `gh stack submit` 은 이 항목에서 빠집니다.

아래 층을 고친 뒤의 항목입니다.

- 지금: `gh stack rebase` 로 위 층을 따라 올리고 `gh stack push` 로 올립니다. 아래 층이 머지된 뒤에는 `gh stack sync` 로 서버의 rebase 를 받아 옵니다.
- 이 RFC 뒤: 위 층의 브랜치에서 아래 층의 브랜치를 `git merge` 로 받고, 강제 옵션 없이 `git push` 로 올립니다. 층의 이력을 선형으로 만드는 rebase 는 서버가 합니다. 서버가 rebase 한 브랜치는 `git fetch` 뒤 로컬 브랜치를 원격 브랜치에 맞추고, 맞추기 전의 로컬 브랜치에서는 push 하지 않습니다. push 한 브랜치는 강제 push 하지 않습니다. `gh stack submit`, `gh stack push`, `gh stack sync`, `gh stack rebase` 뒤에 하는 push 는 쓰지 않습니다.

머지 항목입니다.

- 지금: 머지는 맨 아래부터 하고, `style-guide merge <번호>` 가 `gh stack merge <번호> --squash --yes` 를 부릅니다.
- 이 RFC 뒤: 머지는 맨 아래부터 한 층씩 하고, 명령에는 맨 아래 pull request 의 번호를 줍니다. GitHub 웹의 머지 상자에 있는 "Merge stack" 버튼은 쓰지 않습니다. 이 버튼은 스택의 모든 층을 push 한 번으로 `develop` 에 올리고, `check-landed-commit` 은 그 push 를 실패로 남기고, 머지된 층의 브랜치는 지워지지 않습니다.

`style-guide check-landed-commit` 명령의 실패 메시지도 바꿉니다. 어떤 push 가 통과하고 어떤 push 가 실패하는지는 바뀌지 않습니다. 바뀌는 것은 메시지뿐입니다.

- 지금: push 가 브랜치를 first-parent 로 커밋 하나보다 많이 옮기면 메시지는 `<브랜치> moved from <이전 SHA> to <새 SHA> by more than one first-parent commit` 한 줄입니다.
- 이 RFC 뒤: 그 줄 아래에 push 이벤트가 나열한 커밋을 한 줄에 하나씩 적고, 마지막 줄에 다음 절차를 적습니다. 커밋의 줄에는 짧은 SHA, 그 커밋을 머지 커밋으로 둔 머지된 pull request 의 번호, 커밋 메시지의 첫 줄이 들어갑니다. 그런 pull request 가 없는 커밋에는 `no merged pull request` 를 적습니다.

```
style-guide check-landed-commit: develop moved from <이전 SHA> to <새 SHA> by more than one first-parent commit
The push event lists 3 commit(s):
  4444444 pull request #11: feat: add the login form (#11)
  5555555 pull request #12: feat: validate the login form (#12)
  2222222 no merged pull request: fix a typo
What happens next: the push is reverted before the next release, or the repository's owner checks its content and accepts it.
```

- 명령은 커밋을 20개까지 적고, 나머지는 `... and <수> more` 한 줄로 수만 적습니다.
- pull request 의 번호는 명령이 끝 커밋에 이미 쓰는 `GET /repos/{owner}/{repo}/commits/{sha}/pulls` 로 얻습니다. 이 조회는 위 실패에서만 하고, 적는 커밋마다 한 번 합니다. 끝 커밋은 다시 조회하지 않습니다.
- 커밋의 목록을 읽지 못하거나 조회가 실패하면, 명령은 목록 대신 `The commits the push carried could not be listed: <이유>` 한 줄을 적습니다. 종료 코드는 그대로 1 입니다.
- 다른 실패의 메시지는 한 줄 그대로입니다.

## 이유

저장소 관리자가 2026-10-09 에 네 가지를 결정했습니다.

- 한 번 push 한 브랜치는 강제 push 하지 않고, 위 층은 아래 층의 변경을 `git merge` 로 받습니다.
- 스택은 `style-guide merge` 로 한 층씩 머지하고, 웹의 "Merge stack" 버튼을 쓰지 않습니다.
- 이미 열려 있는 pull request 는 `gh stack link --base develop` 로 스택으로 묶습니다.
- `check-landed-commit` 은 판정을 그대로 두고, 여러 커밋을 올린 push 의 메시지에 무엇이 올라왔는지와 다음 절차를 적습니다.

지금 규칙과 명령은 이 결정과 아래처럼 어긋납니다.

- 지금 규칙이 적은 `gh stack push` 는 `--force-with-lease` 로 push 하고, `gh stack sync` 는 rebase 가 일어나면 `--force-with-lease` 로 push 합니다. `gh stack rebase` 는 로컬 브랜치를 rebase 하므로, 그 뒤의 push 는 강제 옵션이 있어야 원격 브랜치를 바꿉니다. 지금 규칙을 따르면 push 한 브랜치를 강제 push 하게 됩니다.
- 스택의 층을 웹에서 한 번에 머지하면 squash 커밋 여럿이 push 한 번으로 `develop` 에 올라옵니다. `check-landed-commit` 은 push 하나를 pull request 하나로 보므로 그 push 를 실패로 남깁니다. `style-guide merge` 는 스택에서 base 가 `develop` 인 맨 아래 pull request 만 머지하고, 머지된 브랜치도 지웁니다.
- 지금 메시지는 브랜치가 커밋 하나보다 많이 움직였다는 것만 적습니다. 그 push 에 어떤 커밋과 어떤 pull request 가 들었는지는 읽는 사람이 따로 찾아야 하고, 실패 뒤에 할 일도 적혀 있지 않습니다.

`gh stack submit` 도 올리는 브랜치마다 `--force-with-lease` 를 붙여 push 합니다. 저장소 관리자는 2026-10-10 에 세 가지 안 가운데 이 명령을 쓰지 않는 안을 골랐습니다. 브랜치를 처음 올릴 때만 쓰는 안보다 "이 명령은 쓰지 않는다" 가 지키기 쉽다는 것이 이유입니다. 관리자가 고른 것은 안이고, 항목의 문장은 이 제안 문서를 쓴 쪽이 적었습니다.

`gh stack init` 과 `gh stack add` 를 항목에서 뺀 것은 관리자가 고른 것이 아니라 이 제안 문서의 판단입니다. 두 명령은 로컬에 스택 상태를 기록하고, 이 RFC 가 쓰지 않기로 한 `gh stack submit` 과 `gh stack push` 가 그 상태에서 올릴 브랜치를 읽습니다. 이 RFC 뒤의 절차가 쓰는 `gh stack link` 와 `gh stack merge <번호>` 는 그 상태를 읽지 않습니다. 층은 아래 층의 브랜치에서 만든 작업 브랜치이면 됩니다.

서버가 rebase 한 브랜치를 로컬이 받는 방법은 `gh stack sync` 문장이 빠지면 문서에 남지 않습니다. 저장소 관리자는 2026-10-10 에 이 상황을 정하지 않고 두는 안 대신 문장 하나를 더하는 안을 골랐습니다. 문장이 없으면 그 상황을 사람마다 다르게 처리한다는 것이 이유입니다. 이 문장도 이 제안 문서를 쓴 쪽이 적었습니다. 규칙은 로컬 브랜치를 원격 브랜치에 맞추는 명령을 일부러 정하지 않고 읽는 사람에게 맡깁니다. 로컬 브랜치를 원격 브랜치에 맞추는 일은 push 가 아니므로 "강제 push 하지 않는다" 에 걸리지 않습니다.

## 근거

GitHub Docs 의 문서입니다. 2026-10-10 에 읽었습니다.

- "Stacked pull requests CLI commands", https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands
  - `gh stack push`: "Pushes every active branch, excluding merged and queued branches, in a single `git push`, using an explicit per-branch `--force-with-lease` check."
  - `gh stack sync`: "Push. Pushes all branches, using `--force-with-lease` if a rebase occurred."
  - `gh stack submit`: "Creates a pull request for every branch in the stack, pushing branches to the remote." 이 문서는 `gh stack submit` 의 push 에 강제 옵션이 붙는지 적지 않습니다.
  - `gh stack link`: "This command does not create or modify any local tracking state.", "You provide arguments in stack order, from bottom to top.", "Existing pull requests whose base branch does not match the expected chain are corrected automatically."
  - `gh stack merge`: "Merges every pull request in the stack, up to and including the pull request you choose, into the base branch."
- "Managing stacked pull requests", https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/managing-stacked-pull-requests
  - `gh stack rebase` 뒤의 push: "Push the updated branches. This uses `--force-with-lease` to safely update the rebased branches."
  - 웹의 "Rebase stack": "Force-pushes each rebased branch to update the remote."
- "Stacked pull requests", https://docs.github.com/en/pull-requests/reference/stacked-pull-requests
  - "A fully linear history between every branch in the stack is a strict requirement for merging."
  - "When the bottom pull request is merged, a rebase happens automatically and you typically won't need to rebase manually."
  - "Squash creates one clean, squashed commit per pull request. Merging `n` pull requests creates `n` squashed commits on the base branch."
- "Merging stacked pull requests", https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests
  - "The selected pull request and all unmerged pull requests below it land on the base branch together as a single operation, ordered from the bottom up in the resulting history."
- "Webhook events and payloads" 의 `push`, https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
  - `commits`: "An array of commit objects describing the pushed commits. (Pushed commits are all commits that are included in the compare between the before commit and the after commit.) The array includes a maximum of 2048 commits."

`gh stack` 확장의 소스입니다. 저장소 `github/gh-stack` 의 태그 `v0.2.0` 을 2026-10-10 에 읽었습니다.

- `cmd/submit.go:245` 는 `git.Push(remote, []string{b.Branch}, true, false)` 이고, `cmd/push.go:108` 은 `git.Push(remote, activeBranches, true, false)` 입니다. 세 번째 인자가 강제 여부입니다.
- `internal/git/gitops.go:257-276`: 강제 여부가 참이면 브랜치마다 `--force-with-lease=refs/heads/<브랜치>:<sha>` 를 붙입니다. 한 번도 push 하지 않은 브랜치에는 기대하는 값이 빈 `--force-with-lease=refs/heads/<브랜치>:` 를 붙입니다(270-274 행). 빈 값은 "원격에 그 브랜치가 없어야 한다" 는 뜻입니다. 새 브랜치를 처음 올리는 `gh stack submit` 은 덮어쓰는 것이 없지만 옵션은 그때도 붙습니다.
- `cmd/sync.go:292-296`: `gh stack sync` 는 rebase 가 일어났을 때만 강제 여부를 참으로 넘깁니다.
- `cmd/link.go:452` 는 `git.Push(remote, branches, false, true)` 라서 강제 옵션이 없습니다. `cmd/link.go:421-425`: 이 push 는 로컬 브랜치의 이름으로 준 인자만 올리고, pull request 번호로 준 인자는 건너뜁니다.
- `cmd/link.go:718-746`: `gh stack link` 는 base 가 순서와 다른 pull request 의 base 를 API 로 고칩니다. 맨 아래 pull request 의 base 는 `--base` 의 값이고, 위 pull request 의 base 는 바로 아래 pull request 의 head 브랜치입니다.
- `cmd/link.go:31`: "This command does not rely on gh-stack local tracking state."
- `cmd/merge.go:48-51`: "All members of the stack up to and including your chosen pull request are merged into the base branch in a single, all-or-nothing operation". `cmd/merge.go:204-206`: 번호를 준 `gh stack merge` 는 로컬 스택 파일을 읽지 않습니다.
- `cmd/init.go:247` 과 `cmd/add.go:248` 은 로컬 스택 상태를 저장하고, `cmd/submit.go:177` 과 `cmd/push.go:98` 은 그 상태에서 올릴 브랜치를 읽습니다.

관찰입니다.

- 2026-10-08 에 이 패키지를 쓰는 저장소 하나에서, 열려 있던 pull request 다섯을 `gh stack link --base develop` 로 묶고 웹의 "Rebase stack" 으로 선형으로 만든 뒤 웹의 "Merge stack" 버튼으로 머지했습니다. squash 커밋 다섯이 push 한 번으로 `develop` 에 올라왔고, 그 push 의 `landed commit` 검사가 실패했고, head 브랜치 다섯이 지워지지 않고 남았습니다.
- 같은 날 비공개 저장소 하나에서, 위 층들이 머지 커밋을 가진 다섯 층짜리 스택에 "Rebase stack" 을 누르자 서버가 층마다 그 층의 머지 커밋이 아닌 커밋을 아래 층 위에 다시 적용했습니다. 한 번 본 것이고 되풀이해 확인하지 않았습니다. 문서에 적힌 동작이 아닙니다.

이 변경의 검사입니다.

- `npm run test:flow` 352건, `npm test` 32건이 통과했고 `npm run typecheck` 는 오류 없이 끝났습니다.
- 구현하기 전에 `test/cli/check-landed-commit.test.mjs` 의 새 테스트 6건이 실패했습니다. 메시지가 한 줄이고 추가 조회가 없다는 것이 실패의 이유였습니다.
- 이 테스트는 GitHub REST API 처럼 답하는 로컬 HTTP 서버에 명령을 돌려, 명령이 보내는 요청의 목록과 stderr 전체를 확인합니다. 통과하는 push 에서 요청이 둘 그대로이고 `commits` 를 읽지 않는 것도 확인합니다.

확인하지 않은 것은 다음과 같습니다.

- 새 메시지를 실제 GitHub Actions 실행에서 보지 않았습니다. 로컬 HTTP 서버를 쓰는 테스트만 있습니다. 여러 커밋을 push 한 번으로 `develop` 에 올린 저장소에서 `landed commit` 실행의 로그를 읽으면 확인됩니다.
- 스택 머지가 base 브랜치에 올린 squash 커밋이 `GET /repos/{owner}/{repo}/commits/{sha}/pulls` 에서 자기 pull request 로 나오는지 확인하지 않았습니다. 그런 커밋 하나에 이 API 를 호출해 `merge_commit_sha` 가 그 커밋인 pull request 가 있는지 보면 확인됩니다. 나오지 않으면 메시지는 그 커밋에 `no merged pull request` 를 적습니다.
- push 이벤트의 커밋 객체가 가진 속성은 문서가 적지 않습니다. `id` 와 `message` 는 `octokit/webhooks` 저장소의 `payload-schemas/api.github.com/common/commit.schema.json` 에서 읽었습니다. push 로 도는 워크플로에서 `GITHUB_EVENT_PATH` 의 파일을 출력하면 확인됩니다. 모양이 다르면 명령은 목록 대신 그 이유를 한 줄로 적습니다.
- 아래 층을 `git merge` 로 받아 머지 커밋을 가진 층을 서버의 rebase 가 어떻게 다루는지는 문서에 없습니다. 위의 관찰 한 번이 전부입니다. 시험 저장소에서 같은 모양의 스택에 "Rebase stack" 을 되풀이해 누르면 확인됩니다.
- "Merge stack" 이라는 버튼 이름은 위 관찰에서 온 것입니다. 읽은 문서 넷에는 "Rebase stack" 만 있고 이 이름이 없습니다. 스택에 든 pull request 의 머지 상자를 보면 확인됩니다.
- 서버의 rebase 가 만든 커밋이 서명되는지를 문서들이 다르게 적습니다. "Stacked pull requests" 는 "Rebasing the stack generates signed commits." 라고, "Merging stacked pull requests" 는 "Rebasing the stack will generate signed commits" 라고 적습니다. "Managing stacked pull requests" 는 "Commits created by a server-side rebase are **not** signed." 라고 적습니다. 서버가 rebase 한 커밋 하나를 `GET /repos/{owner}/{repo}/commits/{sha}` 로 조회해 `commit.verification` 을 보면 확인됩니다.
- `gh stack` 확장의 push 는 소스를 읽어 확인했고, 원격을 두고 실행해 보지 않았습니다. 버리는 저장소에서 `GIT_TRACE=1` 을 주고 실행하면 확장이 부르는 `git push` 의 인자가 보입니다.

## 쓰는 저장소에 미치는 영향

지금 통과하는 코드와 push 는 이 변경 뒤에도 통과하고, 지금 실패하는 push 는 이 변경 뒤에도 실패합니다. lint 설정, TypeScript 설정, 훅은 바뀌지 않습니다.

- `style-guide init` 이 만드는 파일은 바뀌지 않습니다. 스킬 파일은 규칙 파일의 경로만 적고, 규칙 파일이 늘지 않습니다. 쓰는 저장소는 패키지의 버전을 올려 이 변경을 받고, 이 변경 때문에 `style-guide check` 가 `differs` 를 내지 않습니다.
- push 가 여러 커밋을 올려 `landed commit` 검사가 실패하면, 명령이 `GET /repos/{owner}/{repo}/commits/{sha}/pulls` 를 20번까지 더 부릅니다. `init` 이 둔 push 워크플로의 권한으로 충분합니다. 명령이 끝 커밋에 이미 쓰는 호출입니다.
- 그 검사의 메시지를 읽어 처리하는 스크립트가 있는 저장소는, 그 실패의 메시지가 여러 줄이 된 것에 맞춰 고칩니다. 첫 줄은 그대로입니다.
- 스택을 만들고 고치는 절차를 문서나 스크립트에 적어 둔 저장소는 `gh stack init`, `gh stack add`, `gh stack submit`, `gh stack push`, `gh stack sync`, `gh stack rebase` 를 쓰는 부분을 이 RFC 의 절차로 고칩니다.
- 서명된 커밋을 요구하는 저장소에서 서버의 rebase 가 그 요구를 채우는지는 위의 문서 불일치 때문에 확인하지 못했습니다. 그런 저장소는 스택을 쓰기 전에 직접 확인합니다.

## 이전 제안

`rfcs/open-pull-requests-as-drafts.md` 가 "스택 pull request" 절의 스택을 올리는 명령을 `gh stack submit --auto` 로 적었습니다. 이 RFC 가 그 명령을 `git push`, `gh pr create --draft`, `gh stack link` 로 바꿉니다. 그 제안의 "층마다 준비가 끝나면 `gh pr ready <번호>` 로 draft 를 푼다" 는 그대로입니다. 이 RFC 가 바꾸는 나머지 두 항목을 적은 제안 문서는 없습니다.
