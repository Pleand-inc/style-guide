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
| `rules/RULES.md`, `rules/EXAMPLES.md` | 코드 규칙과 예시 | `node_modules/@pleand-inc/style-guide/rules/` 를 읽습니다 |
| `biome/shared.json` | Biome 포매터와 lint 설정, 플러그인 | `biome.json` 에 `"extends": ["@pleand-inc/style-guide/biome"]` |
| `tsconfig/base.json`, `tsconfig/web.json`, `tsconfig/node.json` | TypeScript 설정 | `tsconfig.json` 에 `"extends": "@pleand-inc/style-guide/tsconfig/web"` 또는 `/node` |

`biome/shared.json` 은 플러그인을 쓰는 저장소의 `node_modules` 경로로 가리킵니다. `biome.json` 은 패키지가 설치된 `node_modules` 가 있는 폴더에 둡니다. 쓰는 저장소는 `@biomejs/biome` 2.5.15 와 `typescript` 를 자기 `devDependencies` 에 둡니다.

## 검사

쓰는 저장소의 검사 게이트는 `biome check` 로 돌립니다. `biome check` 는 lint, 포맷, import 순서를 한 번에 확인합니다. `biome lint` 와 `biome format` 은 import 순서를 확인하지 않습니다. 포맷과 import 순서는 `biome check --write` 로 고칩니다. CI 에서는 `biome ci` 를 써도 같은 진단을 냅니다. `biome ci` 는 읽기 전용이라 파일을 고치지 않습니다.

쓰는 저장소의 `biome.json` 이 `style/noRestrictedImports` 의 `patterns` 를 최상위에 적거나 이 규칙의 옵션을 `overrides` 에 적으면, 공용 설정의 상대 경로 묶음과 확장자 묶음이 모두 사라집니다. 예외가 필요하면 공용 설정의 두 묶음을 함께 옮겨 적고, 그 안에 `!` 로 시작하는 예외를 더합니다.

## 규칙을 바꿀 때

규칙, 설정, 플러그인은 RFC 로 바꿉니다. 절차는 `rfcs/README.md` 에 있습니다.

## 브랜치 흐름

작업 브랜치는 `develop` 으로 squash, `develop` 은 `master` 로 머지 커밋입니다. 절차는 `process/branch-flow.md` 에 있고, 머지는 `node scripts/pr-merge.mjs <PR 번호>` 로 합니다.

## 게시

`develop` 을 `master` 로 올린 뒤, `v` 로 시작하는 태그를 push 하면 `.github/workflows/publish.yml` 이 패키지를 npmjs.com 에 게시합니다. 태그의 이름은 `v` 뒤에 `package.json` 의 `version` 을 붙인 값과 같아야 합니다. 그 버전이 이미 레지스트리에 있으면 워크플로는 게시를 건너뜁니다.

워크플로는 토큰 없이 npm 의 trusted publishing 으로 게시합니다. npmjs.com 의 패키지 설정에서 trusted publisher 로 이 저장소(`Pleand-inc/style-guide`)와 워크플로 파일 이름(`publish.yml`)이 등록되어 있어야 합니다. 이 설정은 패키지가 레지스트리에 한 번 존재해야 할 수 있어서, 첫 버전은 관리자가 자기 컴퓨터에서 `npm login` 뒤 `npm publish` 로 올렸습니다.

## 라이선스

Copyright 2026 Pleand Inc.

이 저장소의 파일은 Mozilla Public License 2.0 을 따릅니다. 전문은 `LICENSE` 에 있습니다.
