# 브랜치 흐름 검사와 저장소 설정을 `style-guide` 명령으로 싣습니다

## 바꾸는 것

지금 패키지에는 `biome/`, `tsconfig/`, `rules/`, `README.md` 만 있습니다. 브랜치 흐름의 스크립트는 이 저장소의 `scripts/` 에 있고 패키지에 실리지 않습니다. 절차 문서 `process/branch-flow.md` 도 실리지 않습니다.

이 RFC 뒤에는 패키지가 `style-guide` 명령과 `process/branch-flow.md` 를 싣습니다. 명령은 다른 npm 패키지에 기대지 않고 Node 20 이상에서 돕니다.

| 명령 | 쓰는 곳 | 하는 일 |
|---|---|---|
| `check-commit` | pre-commit 훅 | `master` 와 `develop` 에서 하는 커밋을 막습니다 |
| `check-push` | pre-push 훅 | `master` 와 `develop` 으로 가는 push 와 삭제, 작업 브랜치가 아닌 브랜치의 push 를 막습니다 |
| `check-pull-request` | GitHub Actions | pull request 의 base 와 head 가 흐름에 있는 짝인지 봅니다 |
| `check-landed-commit` | GitHub Actions | `master` 와 `develop` 에 올라온 커밋이 흐름에 맞게 머지된 pull request 하나인지 봅니다 |
| `merge <번호>` | 사람과 에이전트 | 흐름에 맞는 방식으로 pull request 를 머지합니다. `gh` CLI 를 부릅니다 |
| `init` | 저장소 루트에서 한 번 | 워크플로 둘과 에이전트 스킬을 만들고, husky 훅이 없으면 만들고, 손으로 할 일을 알려 줍니다 |
| `check` | GitHub Actions | `init` 이 둔 것이 없거나 바뀌었으면 실패합니다 |

`init` 이 다루는 파일은 두 종류입니다.

- `init` 이 관리하는 파일은 셋입니다. `.github/workflows/style-guide-pull-request.yml`, `.github/workflows/style-guide-push.yml`, `.claude/skills/style-guide/SKILL.md` 입니다. 내용이 설치된 패키지가 만드는 내용과 다르면 `init` 이 다시 씁니다.
- 훅 파일 `.husky/pre-commit` 과 `.husky/pre-push` 는 없을 때만 만듭니다. 이미 있는 훅 파일은 고치지 않고, 필요한 줄이 없으면 더할 줄을 출력합니다.

`init` 은 그 밖의 파일을 고치지 않습니다. husky 가 없을 때, `biome.json` 이 공용 설정을 받지 않을 때, 패키지의 버전이 고정되어 있지 않을 때는 손으로 할 일로 알려 줍니다.

두 워크플로는 저장소의 의존성을 설치하지 않습니다. `package.json` 의 `devDependencies` 에 적힌 버전의 패키지를 `npm exec` 로 받아 명령을 실행합니다. 버전은 실행할 때 읽으므로 버전을 올려도 워크플로 파일은 바뀌지 않습니다.

작업 브랜치의 접두사와 오래 두는 브랜치는 저장소 루트의 `style-guide.config.json` 에서 바꿀 수 있습니다. 이 파일은 없어도 됩니다.

이 저장소의 `scripts/branch-flow.mjs`, `scripts/branch-flow.test.mjs`, `scripts/pr-merge.mjs` 는 지우고 같은 동작을 `cli/` 로 옮깁니다. 이 저장소에서 머지는 `node cli/style-guide.mjs merge <번호>` 로 합니다. 이 저장소에는 `init` 을 적용하지 않습니다. 이 저장소는 자기 자신을 `devDependencies` 에 두지 않고, GitHub 의 규칙 묶음이 흐름을 서버에서 강제하기 때문입니다.

`process/branch-flow.md` 의 "규칙 묶음이 서버에서 강제합니다" 문장은 규칙 묶음을 쓸 수 있는 저장소의 이야기로 고쳐 씁니다. 이 문서가 규칙 묶음을 쓸 수 없는 저장소에도 배포되기 때문입니다.

## 이유

패키지를 설치하는 것만으로는 저장소에 아무것도 적용되지 않았습니다. 브랜치 흐름은 저장소마다 스크립트를 손으로 복사해 썼고, 복사본의 내용이 서로 달라졌습니다. 코드 규칙은 문서로 `node_modules` 에 놓일 뿐이었고, lint 로 옮긴 규칙도 저장소가 `biome check` 를 훅이나 CI 에 따로 걸어야 적용됐습니다.

저장소 관리자는 패키지를 쓰는 저장소에서 GitHub 의 규칙 묶음을 따로 걸지 않아도 브랜치 흐름과 규칙이 적용되기를 요청했습니다. 명령 하나로 훅과 워크플로와 에이전트 스킬을 두고, 그것이 빠지거나 바뀌면 검사가 실패하게 하는 것이 이 RFC 입니다.

로직은 패키지에 두고, 저장소에 두는 훅과 워크플로에는 명령을 부르는 줄만 둡니다. 그래야 저장소마다 복사본이 생기지 않고, 버전을 올리는 것으로 검사의 내용이 함께 바뀝니다.

`rfcs/README.md` 가 정한 RFC 대상은 규칙, 설정, 플러그인의 변경입니다. 이 변경은 그 셋을 바꾸지 않지만 패키지가 싣는 것을 바꾸므로 RFC 로 올립니다.

## 근거

2026-10-07 에 확인했습니다. 로컬은 Node 26.10.0, npm 11.19.1 입니다.

바꾸기 전의 상태입니다.

- 게시된 0.0.7 을 빈 저장소에 설치했습니다. 설치된 파일은 `biome/` 의 설정과 플러그인 넷, `tsconfig/` 의 셋, `rules/` 의 둘, `README.md`, `LICENSE`, `package.json` 이었습니다. `npm view @pleand-inc/style-guide bin` 은 값이 없었습니다.
- 설치 뒤 `git config --get core.hooksPath` 는 비어 있었고, `enum` 과 상대 경로 import 가 든 파일을 `master` 에 바로 커밋할 수 있었습니다.

이 변경의 검사입니다.

- `npm run test:flow` 333건, `npm test` 39건이 통과했고 `npm run typecheck` 는 오류 없이 끝났습니다. `test:flow` 는 Node 20.0.0 과 20.20.2 에서도 333건이 통과했습니다.
- 검사가 실패할 수 있는지 확인했습니다. "`master` 는 `develop` 만 받는다" 규칙을 지우자 `test:flow` 가 7건 실패했고, 되돌린 뒤 333건이 통과했습니다.
- `test/cli-consumer.test.ts` 는 패키지를 `npm pack` 으로 묶어 임시 저장소에 설치한 뒤 명령을 실행합니다. 게시되는 묶음에 명령이 들어 있고 설치된 자리에서 실행되는지를 봅니다.
- `npm pack --dry-run` 의 목록에 `cli/` 의 파일 19개와 `process/branch-flow.md` 가 있고 테스트 파일은 없습니다.

husky 9.1.7 과 Biome 2.5.15 를 설치한 빈 저장소에서 묶은 패키지로 확인한 것입니다.

- `init` 은 파일 다섯을 만들고 0 으로 끝났습니다. 다시 실행하면 다섯 모두 `unchanged` 였고, `check` 는 0 으로 끝났습니다.
- `master` 에서 한 커밋은 `check-commit` 이 막았습니다. 작업 브랜치에서 규칙에 맞는 파일의 커밋은 통과했고, `enum` 이 든 파일의 커밋은 `lint/style/noEnum` 으로 막혔습니다.
- 작업 브랜치의 push 는 통과했고, `wip` 이라는 이름의 push 는 `check-push` 가 막았습니다.
- `.husky/pre-push` 를 지우면 `check` 가 `missing` 으로, 워크플로 파일을 고치면 `differs` 로, 훅의 줄을 주석으로 막거나 `biome.json` 에서 공용 설정을 빼면 `manual` 로 알리고 1 로 끝났습니다. `init` 은 고친 워크플로만 다시 썼고 훅 파일은 그대로 두었습니다.

규칙 묶음이 없는 비공개 시험 저장소의 GitHub Actions 에서 확인한 것입니다. 패키지는 이 변경의 커밋을 가리키는 git spec 으로 고정했습니다.

- 작업 브랜치에서 `develop` 으로 가는 pull request 에서 `pull request pairing` 과 `style guide setup` 이 통과했습니다. 두 job 은 각각 8초, 7초가 걸렸습니다.
- `style-guide merge` 는 그 pull request 를 squash 로 머지하고 브랜치를 지웠고, `develop` 의 `landed commit` 이 통과했습니다.
- 작업 브랜치에서 `master` 로 가는 pull request 는 `pull request pairing` 이 실패했고, `style-guide merge` 가 거부했습니다.
- 훅 파일을 지우는 pull request 는 `style guide setup` 이 `missing: .husky/pre-push` 로 실패했습니다.
- pull request 없이 API 로 `develop` 을 옮기자 서버는 받아들였고, `landed commit` 이 실패했습니다.
- `develop` 에서 `master` 로 가는 pull request 를 `style-guide merge` 로 머지하자 제목이 `<제목> (#<번호>)` 이고 부모가 둘인 머지 커밋이 생겼고, `master` 의 `landed commit` 이 통과했습니다.
- `master` 와 `develop` 을 처음 만든 push 는 `landed commit` 이 실패로 표시했습니다.

확인하지 않은 것은 다음과 같습니다.

- 레지스트리에 게시된 정확한 버전을 `npm exec` 로 받는 경로는 돌리지 못했습니다. 명령이 든 버전이 아직 게시되지 않았습니다. 워크플로가 버전 문자열을 `@pleand-inc/style-guide@<버전>` 으로 바꾸는 것까지만 테스트로 확인했습니다.
- 스택 pull request 를 이 명령으로 GitHub 에서 머지해 보지 않았습니다. `gh` 를 부르는 순서만 가짜 `gh` 로 확인했습니다.
- Windows 에서 돌려 보지 않았습니다.
- 생성된 워크플로를 `actionlint` 로 검사하지 않았습니다.

## 쓰는 저장소에 미치는 영향

지금 통과하는 코드는 이 변경 뒤에도 통과합니다. 규칙, lint 설정, 포매터 설정, TypeScript 설정은 바뀌지 않습니다. 패키지의 버전을 올리는 것만으로는 저장소에 새로 걸리는 검사가 없습니다.

- 훅과 워크플로를 두려면 저장소 루트에서 `npx style-guide init` 을 실행합니다. 그 뒤로는 `init` 이 둔 것을 지우거나 고친 pull request 가 `style guide setup` 에서 실패합니다.
- 훅을 쓰려면 저장소에 husky 가 있어야 하고, `merge` 를 쓰려면 `gh` CLI 가 있어야 합니다.
- 브랜치 흐름의 스크립트를 복사해 쓰던 저장소는 복사본을 지우고 이 명령을 부르게 바꿉니다. 작업 브랜치의 접두사나 오래 두는 브랜치가 기본값과 다르면 `style-guide.config.json` 에 적습니다.
- 규칙 묶음을 쓸 수 없는 저장소에서는 서버가 흐름을 벗어난 머지와 push 를 막지 않습니다. `check-landed-commit` 은 그런 커밋을 들어간 뒤에 실패로 표시합니다.
- 버전을 올린 뒤에는 `init` 을 다시 실행합니다. 스킬 파일이 설치된 패키지의 규칙 파일 목록을 적으므로, 규칙 파일의 구성이 바뀐 버전에서는 `check` 가 `differs` 로 알려 줍니다.
