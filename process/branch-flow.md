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
