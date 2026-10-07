# 브랜치 흐름

Pleand 의 저장소가 쓰는 브랜치 흐름입니다. 이 문서는 절차를 적습니다. 코드 규칙은 `rules/RULES.md` 에 있습니다.

## 브랜치

| 브랜치 | 역할 | 받는 것 |
|---|---|---|
| `master` | 게시되는 브랜치 | `develop` 에서 오는 머지 커밋만 |
| `develop` | 통합 브랜치 | 작업 브랜치의 squash 커밋만 |
| `feat\|fix\|chore\|docs/<slug>` | 작업 브랜치 | 커밋 |

작업 브랜치는 `develop` 에서 만듭니다. `master` 와 `develop` 에 직접 push 하지 않습니다.

## pull request 와 머지

- 작업 브랜치는 `develop` 으로 pull request 를 올리고 squash 로 머지합니다. 머지되면 브랜치를 지웁니다.
- `develop` 은 `master` 로 pull request 를 올리고 머지 커밋으로 머지합니다. 머지 커밋의 제목은 pull request 의 제목 뒤에 `(#<번호>)` 를 붙인 것입니다. `develop` 은 지우지 않습니다.
- 머지는 `node scripts/pr-merge.mjs <번호>` 로 합니다. pull request 의 base 와 head 를 보고 방식을 고르고, 짝이 틀리면 거부합니다. 판단 로직은 `scripts/branch-flow.mjs` 에 있고 검사는 `npm run test:flow` 입니다.
- 저장소의 규칙 묶음이 같은 내용을 서버에서 강제합니다. `master` 와 `develop` 은 pull request 로만 바뀌고, `develop` 은 squash 만, `master` 는 머지 커밋만 허용합니다. 우회 대상은 없습니다.

## 릴리스

`develop` 을 `master` 로 올리는 pull request 를 머지한 뒤, `v` 뒤에 `package.json` 의 `version` 을 붙인 태그를 push 합니다. 게시 워크플로는 저장소 루트의 `README.md` 에 있습니다.

## 스택 pull request

한 작업이 서로 의존하는 변경 여럿으로 나뉘면 GitHub 의 스택 pull request 를 씁니다. 맨 아래 pull request 는 `develop` 을 base 로 두고, 위의 pull request 는 바로 아래 pull request 의 브랜치를 base 로 둡니다. 검토자는 층마다 그 층의 변경만 봅니다.

- 스택은 `gh stack` 확장으로 만듭니다. `gh stack init --base develop <첫 브랜치>` 로 시작하고, 다음 층은 `gh stack add <브랜치>` 로 더하고, `gh stack submit --open` 으로 push 와 pull request 생성을 한 번에 합니다.
- 한 층에는 아래 층에 기대는 변경만 둡니다. 다른 관심사가 시작되면 새 층을 만듭니다.
- 머지는 맨 아래부터 합니다. 아래 pull request 를 머지하면 위의 pull request 가 자동으로 `develop` 을 base 로 바꾸고 서버에서 rebase 됩니다. 머지 방식은 스택이 아닐 때와 같이 squash 이고, 머지는 `node scripts/pr-merge.mjs <번호>` 로 합니다.
- 스택 안의 모든 pull request 에 `develop` 의 규칙 묶음이 적용됩니다.
- 아래 층을 고치면 `gh stack rebase` 로 위 층을 따라 올리고 `gh stack push` 로 올립니다.
