# Biome 공용 설정과 플러그인 두 개를 넣습니다

## 바꾸는 것

지금 패키지에는 설정이 없습니다. 이 RFC 뒤에는 패키지가 다음을 담습니다.

- `biome/shared.json`: 포매터 옵션과 lint 규칙을 담은 Biome 설정입니다. 쓰는 저장소는 `biome.json` 에 `"extends": ["@pleand-inc/style-guide/biome"]` 를 적어 받습니다.
- `biome/plugins/max-block-depth.grit`: 블록을 4단보다 깊게 중첩한 코드를 오류로 보고하는 플러그인입니다.
- `biome/plugins/no-suppression-comment.grit`: `biome-ignore` 억제 주석이 있는 파일을 오류로 보고하는 플러그인입니다.
- `peerDependencies` 의 `@biomejs/biome` 2.5.15: 설정과 플러그인을 확인한 Biome 버전입니다.

`biome/shared.json` 이 켜는 것은 다음과 같습니다.

| 규칙 | Biome 의 규칙 | 값 |
|---|---|---|
| Biome 권장 규칙 | `recommended` | 켬 |
| 상대 경로 가져오기 금지 | `style/noRestrictedImports` | `.`, `..`, `./**`, `../**` |
| 함수의 인자 수 | `complexity/useMaxParams` | 3개 이하 |
| 함수 본문의 줄 수 | `complexity/noExcessiveLinesPerFunction` | 80줄 이하 |
| 함수의 인지 복잡도 | `complexity/noExcessiveCognitiveComplexity` | 15 이하 |
| 중첩 삼항 금지 | `style/noNestedTernary` | 켬 |
| `enum` 금지 | `style/noEnum` | 켬 |
| non-null 단언 금지 | `style/noNonNullAssertion` | 켬 |
| `any` 금지 | `suspicious/noExplicitAny` | 켬 |
| 타입 단언 금지 | `nursery/noUnsafeTypeAssertion` | 켬 |
| 블록 깊이 | 플러그인 `max-block-depth` | 4단 이하 |
| 억제 주석 금지 | 플러그인 `no-suppression-comment` | 켬 |
| 들여쓰기 | `formatter.indentStyle` | 공백 |
| 줄 길이 | `formatter.lineWidth` | 80 |

저장소에는 `npm test` 와 pull request 마다 `npm test` 를 실행하는 워크플로를 함께 넣습니다.

## 이유

lint 와 포매터를 Biome 하나로 맡깁니다. 규칙은 Biome 의 내장 규칙으로 걸고, 내장 규칙이 없는 규칙은 Biome 의 GritQL 플러그인으로 겁니다. 블록 깊이 제한과 억제 주석 금지는 Biome 2.5.15 에 내장 규칙이 없어서 플러그인으로 넣었습니다.

포맷은 Prettier 의 기본값과 같게 둡니다. 공백 2칸 들여쓰기, 줄 길이 80, 큰따옴표, 세미콜론입니다. Prettier 로 맞춰 온 코드가 가장 적게 바뀝니다. Biome 의 기본값과 다른 것은 들여쓰기뿐이어서 설정에는 들여쓰기와 줄 길이만 적습니다.

## 근거

`npm test` 가 패키지를 `npm pack` 으로 묶어 임시 폴더의 `node_modules` 에 풀고, 그 폴더에서 `extends` 로 설정을 받아 Biome 을 실행합니다. 2026-10-06 에 Node 26.10.0 과 Biome 2.5.15 로 실행해 14건이 모두 통과했습니다.

- `test/fixtures/biome/violations/` 의 파일은 규칙 하나씩을 어기고, 검사는 파일마다 그 규칙의 진단만 정해진 수만큼 나오는지 확인합니다.
- `test/fixtures/biome/conforming/` 의 파일은 한도에 꼭 맞는 코드입니다. 인자 3개, 본문 80줄, 인지 복잡도 15, 블록 4단, `as const`, `satisfies`, 패키지 이름으로 가져오기가 들어 있습니다. 검사는 `biome check` 의 진단이 0건인지 확인합니다.
- `max` 를 4로 바꾸거나 `conforming` 의 파일에 포맷이 어긋난 줄을 넣으면 검사가 실패하는 것을 확인했습니다.

읽은 문서는 다음과 같습니다.

- https://biomejs.dev/linter/plugins/
- https://biomejs.dev/reference/gritql/
- https://biomejs.dev/analyzer/suppressions/
- https://biomejs.dev/reference/configuration/

실행해서 확인한 제약은 다음과 같습니다.

- `extends` 로 받은 설정의 플러그인 경로는 패키지 폴더가 아니라 쓰는 저장소의 설정 폴더를 기준으로 풀립니다. `./plugins/…` 로 적으면 `Cannot read file` 로 실패하고, 패키지 이름으로 적어도 같은 오류가 납니다. 그래서 `biome/shared.json` 은 플러그인을 `./node_modules/@pleand-inc/style-guide/biome/plugins/…` 로 적습니다.
- 블록 깊이 플러그인은 중괄호 블록의 중첩을 셉니다. 블록 안의 콜백 함수 본문에 있는 블록도 바깥 블록에 이어서 셉니다. 중괄호가 없는 한 줄 `if` 는 세지 않습니다. `else if` 로 이은 갈래는 깊이를 늘리지 않습니다.
- 억제 주석 플러그인은 파일의 첫 코드 뒤에 있는 `// biome-ignore` 와 `/* biome-ignore` 를 잡습니다. 오류의 위치는 주석 줄이 아니라 파일의 첫 코드입니다.
- 억제 주석 플러그인이 잡지 못하는 경우가 세 가지 있습니다. 첫째, 파일의 첫 코드보다 앞에 놓인 주석입니다. 파일 단위 억제 `biome-ignore-all` 은 파일 맨 위에만 둘 수 있어서 모두 여기에 듭니다. 둘째, 파일 맨 위의 `// biome-ignore-all lint/plugin` 과 `// biome-ignore-all lint` 입니다. 플러그인의 진단을 끕니다. 셋째, 첫 코드 바로 윗줄의 `// biome-ignore lint/plugin` 입니다.
- `complexity/noExcessiveCognitiveComplexity` 는 인지 복잡도를 잽니다. 순환 복잡도를 재는 규칙은 Biome 2.5.15 에 없습니다.
- `complexity/noExcessiveLinesPerFunction` 은 함수 본문의 줄 수를 셉니다. 본문 80줄은 통과하고 81줄은 실패합니다.
- `nursery/noUnsafeTypeAssertion` 은 `값 as 타입`, `값 as unknown as 타입`, `<타입>값` 을 잡고 `as const` 와 `satisfies` 는 통과시킵니다.
- `style/noRestrictedImports` 는 `import`, `import type`, `export … from`, `import()` 의 상대 경로를 잡습니다. `require("./x")` 는 잡지 않았습니다.
- Biome 의 Grit 정규식에서 `\s` 와 괄호 묶음을 쓴 패턴은 맞지 않았습니다. 플러그인은 문자 묶음 `[/*]` 와 `[ ]` 를 씁니다.

확인하지 않은 것은 다음과 같습니다.

- pnpm 으로 설치한 저장소에서 `node_modules` 의 링크를 거쳐 플러그인을 읽는지 확인하지 않았습니다. 검사는 패키지를 `node_modules` 에 직접 풀었습니다.
- 저장소 안의 하위 폴더에 둔 설정이 `"extends": "//"` 로 루트 설정을 받을 때 플러그인 경로가 어느 폴더를 기준으로 풀리는지 확인하지 않았습니다.
- Biome 권장 규칙과 typescript-eslint 권장 규칙의 항목별 차이를 비교하지 않았습니다.
- `nursery` 묶음의 규칙과 Biome 의 문법 노드 이름은 버전 사이에 바뀔 수 있다고 Biome 문서가 적고 있습니다. Biome 2.5.15 가 아닌 버전에서는 실행하지 않았습니다.

## 쓰는 저장소에 미치는 영향

이 설정을 처음 받는 저장소에서는 위 표의 규칙을 어기는 코드가 실패합니다. 쓰는 저장소는 다음을 합니다.

- `@biomejs/biome` 2.5.15 와 `@pleand-inc/style-guide` 를 같은 `package.json` 의 `devDependencies` 에 넣습니다.
- `biome.json` 을 그 `package.json` 과 같은 폴더에 두고 `"extends": ["@pleand-inc/style-guide/biome"]` 를 적습니다. 플러그인 경로가 그 폴더의 `node_modules` 를 가리키기 때문입니다.
- 저장소의 폴더 구조에 달린 규칙은 쓰는 저장소의 `biome.json` 에 둡니다. 다른 패키지의 내부 경로를 가져오지 못하게 하는 규칙과, 프레임워크가 인자의 수를 정한 함수를 `useMaxParams` 에서 빼는 `overrides` 가 여기에 듭니다.
- 검사에서 뺄 파일은 쓰는 저장소의 `biome.json` 의 `files.includes` 에 적습니다.
