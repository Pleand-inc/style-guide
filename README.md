# style-guide

Pleand 의 TypeScript 코드 규칙을 담는 저장소입니다. 규칙 문서와 lint, TypeScript 설정을 `@pleand-inc/style-guide` 패키지로 npmjs.com 에 게시합니다. 공개 패키지라 설치에 토큰이 필요하지 않습니다.

## 설치

```sh
pnpm add -D -E @biomejs/biome@2.5.15 @pleand-inc/style-guide
```

npm 이나 yarn 도 같습니다. 토큰은 필요하지 않습니다. `@biomejs/biome` 은 이 패키지의 peerDependency 라 같은 버전을 함께 설치합니다.

## 패키지에 든 것

| 경로 | 내용 | 받는 방법 |
|---|---|---|
| `rules/README.md`, `rules/typescript/<주제>/`, `rules/git/<주제>/` | TypeScript 코드 규칙과 git 규칙(브랜치 흐름, 변경 이력과 티켓). 주제마다 폴더 하나에 `RULES.md` 와, 예시가 있으면 `EXAMPLES.md` | `node_modules/@pleand-inc/style-guide/rules/README.md` 부터 읽습니다 |
| `biome/shared.json` | Biome 포매터와 lint 설정, 플러그인 | `biome.json` 에 `"extends": ["@pleand-inc/style-guide/biome"]` |
| `tsconfig/base.json`, `tsconfig/web.json`, `tsconfig/node.json` | TypeScript 설정 | `tsconfig.json` 에 `"extends": "@pleand-inc/style-guide/tsconfig/web"` 또는 `/node` |
| `cli/` | `style-guide` 명령 | `npx style-guide <명령>` 또는 `node_modules/.bin/style-guide <명령>` |

`biome/shared.json` 은 플러그인을 쓰는 저장소의 `node_modules` 경로로 가리킵니다. `biome.json` 은 패키지가 설치된 `node_modules` 가 있는 폴더에 둡니다. 쓰는 저장소는 `@biomejs/biome` 2.5.15 와 `typescript` 를 자기 `devDependencies` 에 둡니다.

`style-guide` 명령은 Node 20 이상에서 돌고, 다른 npm 패키지에 기대지 않습니다. `merge` 명령만 GitHub 의 `gh` CLI 를 부릅니다. 명령의 목록은 `npx style-guide --help` 가 출력합니다.

## 설치한 뒤

패키지를 설치하는 것만으로는 저장소에 아무것도 적용되지 않습니다. 저장소 루트에서 아래 명령을 실행합니다.

```sh
npx style-guide init
```

`init` 은 아래 세 파일을 만듭니다. 세 파일은 `init` 이 관리하므로 손으로 고치지 않습니다. 파일의 내용이 설치된 패키지가 만드는 내용과 다르면 `init` 이 다시 씁니다.

| 파일 | 하는 일 |
|---|---|
| `.github/workflows/style-guide-pull-request.yml` | pull request 의 base 와 head 가 브랜치 흐름에 맞는지 `pull request pairing into <base>` 검사로 확인하고, `style-guide check` 를 `style guide setup` 검사로 돌립니다 |
| `.github/workflows/style-guide-push.yml` | `master` 와 `develop` 에 올라온 커밋이 머지된 pull request 하나에서 왔는지 검사합니다 |
| `.claude/skills/style-guide/SKILL.md` | 에이전트가 설치된 패키지의 코드 규칙과 브랜치 흐름을 읽게 하는 스킬입니다 |

두 워크플로는 저장소의 의존성을 설치하지 않습니다. `package.json` 의 `devDependencies` 에 적힌 버전의 패키지를 `npm exec` 로 받아 실행합니다. 버전은 실행할 때 읽으므로, 버전을 올려도 워크플로 파일은 바뀌지 않습니다.

`init` 은 husky 훅 `.husky/pre-commit` 과 `.husky/pre-push` 를 파일이 없을 때만 만듭니다. 만든 훅에는 아래 줄이 들어갑니다.

| 훅 | 줄 | 막는 것 |
|---|---|---|
| `.husky/pre-commit` | `node_modules/.bin/style-guide check-commit` | `master` 와 `develop` 에서 하는 커밋 |
| `.husky/pre-commit` | `node_modules/.bin/biome check --staged --no-errors-on-unmatched` | 규칙에 어긋난 파일의 커밋 |
| `.husky/pre-push` | `node_modules/.bin/style-guide check-push` | 브랜치 흐름에 맞지 않는 push |

훅 파일이 이미 있는데 필요한 줄이 없으면, `init` 은 그 파일을 고치지 않습니다. 그 파일을 `incomplete` 로 표시하고 더할 줄을 출력합니다. 주석으로 막아 둔 줄은 없는 줄로 봅니다.

`init` 은 아래 세 가지를 고치지 않고 알려 주기만 합니다. 직접 고친 뒤 `init` 을 다시 실행합니다.

- `devDependencies` 에 `husky` 가 없거나, husky 를 실행하는 `prepare` 스크립트가 없습니다. `husky` 를 설치하고 `scripts` 에 `"prepare": "husky"` 를 적습니다.
- `biome.json` 과 `biome.jsonc` 가운데 `@pleand-inc/style-guide/biome` 을 가리키는 파일이 없습니다.
- `devDependencies` 의 `@pleand-inc/style-guide` 가 정확한 버전이나 git spec 으로 고정되어 있지 않습니다. 워크플로가 이 값을 읽어 같은 버전의 명령을 실행합니다.

`init` 은 파일마다 한 일을 `created`, `rewritten`, `unchanged` 가운데 하나로 한 줄씩 출력하고, 손으로 할 일마다 `manual:` 로 시작하는 한 줄을 출력합니다. 손으로 할 일이 남지 않으면 0 으로, 남으면 1 로 끝납니다. 패키지의 버전을 올린 뒤에도 `init` 을 다시 실행합니다.

```sh
npx style-guide check
```

`check` 는 `init` 과 같은 항목을 읽기만 합니다. `init` 이 관리하는 파일이 없거나 내용이 다를 때, 훅에 필요한 줄이 없을 때, 손으로 할 일이 남았을 때 그 항목을 출력하고 1 로 끝납니다. `init` 이 만든 pull request 워크플로가 `check` 를 돌리므로, 훅을 지우거나 워크플로를 고친 pull request 는 검사에서 실패합니다.

작업 브랜치의 접두사는 `feat`, `fix`, `chore`, `docs` 이고, 오래 두는 브랜치는 없습니다. 이 두 목록을 바꾸는 저장소는 루트에 `style-guide.config.json` 을 둡니다. 이 파일은 없어도 됩니다.

```json
{
  "branchFlow": {
    "workBranchPrefixes": ["feat", "fix", "chore", "docs"],
    "longLivedBranches": []
  }
}
```

`longLivedBranches` 에 적은 브랜치에는 push 할 수 있습니다. 이 브랜치는 `develop` 이나 `master` 로 가는 pull request 의 head 가 될 수 없습니다. 파일에 모르는 키가 있거나, 값의 형식이 틀리거나, 접두사 목록이 비어 있으면 명령은 그 키의 이름을 출력하고 2 로 끝납니다.

## 검사

쓰는 저장소의 검사 게이트는 `biome check` 로 돌립니다. `biome check` 는 lint, 포맷, import 순서를 한 번에 확인합니다. `biome lint` 와 `biome format` 은 import 순서를 확인하지 않습니다. 포맷과 import 순서는 `biome check --write` 로 고칩니다. CI 에서는 `biome ci` 를 써도 같은 진단을 냅니다. `biome ci` 는 읽기 전용이라 파일을 고치지 않습니다.

쓰는 저장소의 `biome.json` 이 `style/noRestrictedImports` 의 `patterns` 를 최상위에 적거나 이 규칙의 옵션을 `overrides` 에 적으면, 공용 설정의 상대 경로 묶음과 확장자 묶음이 모두 사라집니다. 예외가 필요하면 공용 설정의 두 묶음을 함께 옮겨 적고, 그 안에 `!` 로 시작하는 예외를 더합니다.

## 규칙을 바꿀 때

규칙, 설정, 플러그인은 RFC 로 바꿉니다. 절차는 `rfcs/README.md` 에 있습니다.

## 브랜치 흐름

작업 브랜치는 `develop` 으로 squash, `develop` 은 `master` 로 머지 커밋입니다. 절차는 `rules/git/branch-flow/RULES.md` 에 있습니다. 머지는 이 저장소에서 `node cli/style-guide.mjs merge <PR 번호>` 로 하고, 패키지를 쓰는 저장소에서 `node_modules/.bin/style-guide merge <PR 번호>` 로 합니다.

## 게시

`develop` 을 `master` 로 올린 뒤, `v` 로 시작하는 태그를 push 하면 `.github/workflows/publish.yml` 이 패키지를 npmjs.com 에 게시합니다. 태그의 이름은 `v` 뒤에 `package.json` 의 `version` 을 붙인 값과 같아야 합니다. 그 버전이 이미 레지스트리에 있으면 워크플로는 게시를 건너뜁니다.

워크플로는 토큰 없이 npm 의 trusted publishing 으로 게시합니다. npmjs.com 의 패키지 설정에서 trusted publisher 로 이 저장소(`Pleand-inc/style-guide`)와 워크플로 파일 이름(`publish.yml`)이 등록되어 있어야 합니다. 이 설정은 패키지가 레지스트리에 한 번 존재해야 할 수 있어서, 첫 버전은 관리자가 자기 컴퓨터에서 `npm login` 뒤 `npm publish` 로 올렸습니다.

## 라이선스

Copyright 2026 Pleand Inc.

이 저장소의 파일은 Mozilla Public License 2.0 을 따릅니다. 전문은 `LICENSE` 에 있습니다.
