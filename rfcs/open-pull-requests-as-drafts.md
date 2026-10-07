# pull request 는 draft 로 올리고, 준비가 끝나면 draft 를 풉니다

## 바꾸는 것

`rules/git/branch-flow/RULES.md` 의 "pull request 와 머지" 절에 규칙 문장 하나를 더합니다.

- pull request 는 draft 로 올립니다(`gh pr create --draft`). 작업과 검사가 끝나 검토와 머지를 받을 준비가 되면 `gh pr ready <번호>` 로 draft 를 풉니다. 작업 브랜치에서 `develop` 으로 가는 pull request 와 `develop` 에서 `master` 로 가는 pull request 모두 같습니다. Dependabot 이 여는 pull request 는 draft 가 아닙니다.

같은 문서의 "스택 pull request" 절은 스택을 올리는 명령을 `gh stack submit --open` 에서 `gh stack submit --auto` 로 바꾸고, 층마다 준비가 끝나면 `gh pr ready <번호>` 로 draft 를 푼다고 적습니다.

## 이유

저장소 관리자가 pull request 는 기본으로 draft 로 올리고, 작업 준비가 끝나면 draft 를 풀어 ready 상태로 두기를 요청했습니다.

- draft 인지가 "아직 작업 중" 과 "검토와 머지를 받을 준비가 됨" 을 나눕니다. 검사가 돌고 있거나 실패한 pull request 를 검토자가 먼저 보지 않습니다.
- `style-guide merge` 는 이미 draft 인 pull request 를 거부합니다(`cli/lib/branch-flow.mjs` 의 `is a draft: mark it ready for review first`). 이 규칙으로 draft 를 푸는 일이 머지 전에 하는 한 단계가 됩니다.

## 근거

- `gh stack submit --help`(gh-stack v0.2.0): "With --auto, new PRs are created as drafts unless you pass --open." 지금 규칙이 적은 `--open` 은 pull request 를 ready 로 만듭니다.
- `cli/lib/branch-flow.mjs` 의 머지 판단은 `isDraft` 가 참이면 머지를 거부합니다.
- 2026-10-07 에 쓰는 저장소 하나에서 pull request 를 `gh pr create --draft` 로 열고, 검사가 끝난 뒤 `gh pr ready` 로 푼 다음 머지했습니다.

## 쓰는 저장소에 미치는 영향

코드와 검사 결과는 바뀌지 않습니다. 규칙 문서와, `style-guide init` 이 만드는 스킬이 가리키는 브랜치 흐름 문서의 내용만 바뀝니다. 스킬 파일 자체는 바뀌지 않으므로 `style-guide init` 을 다시 실행할 필요가 없습니다.
