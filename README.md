# style-guide

Pleand 의 TypeScript 코드 규칙을 담는 저장소입니다. 규칙 문서와 lint, TypeScript 설정을 `@pleand-inc/style-guide` 패키지로 GitHub Packages 에 게시합니다.

## 패키지에 든 것

| 경로 | 내용 | 받는 방법 |
|---|---|---|
| `rules/RULES.md`, `rules/EXAMPLES.md` | 코드 규칙과 예시 | `node_modules/@pleand-inc/style-guide/rules/` 를 읽습니다 |
| `biome/shared.json` | Biome 포매터와 lint 설정, 플러그인 | `biome.json` 에 `"extends": ["@pleand-inc/style-guide/biome"]` |
| `tsconfig/base.json`, `tsconfig/web.json`, `tsconfig/node.json` | TypeScript 설정 | `tsconfig.json` 에 `"extends": "@pleand-inc/style-guide/tsconfig/web"` 또는 `/node` |

`biome/shared.json` 은 플러그인을 쓰는 저장소의 `node_modules` 경로로 가리킵니다. `biome.json` 은 패키지가 설치된 `node_modules` 가 있는 폴더에 둡니다. 쓰는 저장소는 `@biomejs/biome` 2.5.15 와 `typescript` 를 자기 `devDependencies` 에 둡니다.

## 규칙을 바꿀 때

규칙, 설정, 플러그인은 RFC 로 바꿉니다. 절차는 `rfcs/README.md` 에 있습니다.

## 브랜치 흐름

`feat|fix|chore|docs/<slug>` 브랜치에서 `develop` 으로 pull request 를 올리고 squash 로 머지합니다. `develop` 에서 `master` 로 pull request 를 올리고 머지 커밋으로 머지합니다. `master` 는 `develop` 에서 오는 머지 커밋만 받습니다. `master` 와 `develop` 에 직접 push 하지 않습니다.

머지는 `node scripts/pr-merge.mjs <PR 번호>` 로 합니다. 대상에 맞는 방식을 고르고 짝이 틀리면 거부합니다. 판단 로직은 `scripts/branch-flow.mjs` 에 있고 검사는 `npm run test:flow` 입니다.

## 게시

`develop` 을 `master` 로 올린 뒤, `v` 로 시작하는 태그를 push 하면 `.github/workflows/publish.yml` 이 패키지를 게시합니다. 태그의 이름은 `v` 뒤에 `package.json` 의 `version` 을 붙인 값과 같아야 합니다.

## 라이선스

Copyright 2026 Pleand Inc.

이 저장소의 파일은 Mozilla Public License 2.0 을 따릅니다. 전문은 `LICENSE` 에 있습니다.
