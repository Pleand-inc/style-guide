# import 경로에 붙인 파일 확장자를 막습니다

## 바꾸는 것

지금 `biome/shared.json` 의 `style/noRestrictedImports` 는 `patterns` 에 상대 경로 묶음 하나를 둡니다. 이 RFC 뒤에는 그 옆에 확장자 묶음을 더합니다.

| 묶음 | `group` | 메시지 |
|---|---|---|
| 상대 경로, 지금 있음 | `.`, `..`, `./**`, `../**` | Import through the alias declared in tsconfig paths instead of a relative path. |
| 확장자, 새로 더함 | `*/**/*.js`, `*/**/*.mjs`, `*/**/*.cjs`, `*/**/*.jsx`, `*/**/*.ts`, `*/**/*.mts`, `*/**/*.cts`, `*/**/*.tsx` | Import paths do not carry a file extension. Drop the extension; the alias or package import map resolves it. |

확장자 묶음은 `/` 가 적어도 하나 있는 경로에만 맞습니다. 상대 경로는 이미 금지라서, `/` 가 없는 지정자는 언제나 패키지 이름입니다. 그래서 `chart.js`, `highlight.js`, `decimal.js` 처럼 이름이 `.js` 로 끝나는 패키지는 잡지 않습니다.

이 규칙이 보는 문법은 `import`, `import type`, `export … from`, `export * from`, 문자열 리터럴 하나를 받은 `import()` 입니다. 타입 위치의 `import()`, `vi.mock` 같은 Vitest 호출, `import.meta.glob` 의 경로는 보지 않습니다.

문서는 다음처럼 바뀝니다.

- `rules/RULES.md` 의 작성 가이드에 "가져오기 경로의 확장자" 한 줄을 더합니다. 모듈 경로 끝에 위 여덟 확장자를 붙이지 않는다는 문장입니다. `.json`, `.css`, `.svg` 같은 자원 파일의 경로에는 확장자를 적고, `chart.js` 처럼 이름이 확장자로 끝나는 패키지는 그 이름으로 가져온다고 함께 적습니다.
- `README.md` 의 "검사" 절에 한 단락을 더합니다. 쓰는 저장소가 `patterns` 를 최상위에 적거나 이 규칙의 옵션을 `overrides` 에 적으면 공용 설정의 두 묶음이 모두 사라진다는 내용입니다. 예외가 필요하면 두 묶음을 함께 옮겨 적고 `!` 로 시작하는 예외를 더한다고 적습니다.

검사에는 다음을 더합니다.

- 위반 예시 `test/fixtures/biome/violations/import-with-extension.ts`: 여덟 확장자마다 별칭 경로 `@acme/web/modules/widget.<확장자>` 와 패키지 import `#scripts/widget.<확장자>` 를 하나씩 가져옵니다. `style/noRestrictedImports` 의 error 16건이 나와야 합니다.
- 규칙에 맞는 예시 `test/fixtures/biome/conforming/imports.ts`: 별칭 경로의 `.css`, `.json`, Vite 의 `?raw` 접미를 붙인 `.ts` 경로, 패키지 `chart.js` 를 가져옵니다. 진단이 없어야 합니다. 이 예시는 Biome 만 검사하고 TypeScript 는 컴파일하지 않으므로, `chart.js` 를 설치하지 않아도 됩니다.

## 이유

규칙 문서의 "가져오기 경로" 는 별칭으로 시작하는 경로로 가져온다고 정합니다. 이 설정을 쓰는 저장소 하나는 import 경로에 파일 확장자를 쓰지 않는다는 규칙을 ESLint 로 막고 있었습니다. ESLint 를 지우면서 이 규칙을 지키는 검사가 없어졌습니다.

쓰는 저장소가 이 규칙을 자기 `biome.json` 에 덧붙일 수는 없습니다. 아래 근거처럼, 쓰는 저장소가 `overrides` 에 `style/noRestrictedImports` 의 옵션을 적으면 공용 설정의 옵션이 통째로 바뀝니다. 그러면 상대 경로 묶음도 함께 사라집니다. 그래서 공용 설정에 넣습니다.

## 근거

2026-10-07 에 Node 26.10.0 과 Biome 2.5.15 로 실행했습니다. 패키지를 `npm pack` 으로 묶어 임시 폴더에 설치하고, 그 폴더에서 `extends` 로 설정을 받아 `biome lint` 를 실행했습니다.

`biome explain noRestrictedImports` 는 `patterns` 의 `group` 이 gitignore 형식의 패턴이라고 적습니다. 지정자마다 `import "<지정자>";` 한 줄짜리 파일을 만들어 진단을 셌습니다.

| 지정자 | 진단 |
|---|---|
| `@acme/web/x.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, `.tsx` | 확장자 묶음 1건씩 |
| `#scripts/x.mjs`, `#x/y.ts`, `@acme/web/deep/er/x.ts` | 확장자 묶음 1건씩 |
| `@acme/web/x.d.ts` | 확장자 묶음 1건 |
| `lit/decorators.js`, `@acme/chart.js` | 확장자 묶음 1건씩 |
| `chart.js`, `highlight.js`, `decimal.js` | 0건 |
| `x.ts`, `x.js`, `x.d.ts` | 0건 |
| `highlight.js/lib/core` | 0건 |
| `@acme/web/data.json`, `style.css`, `icon.svg` | 0건 |
| `@acme/web/x.ts?raw`, `style.css?inline`, `icon.svg?url` | 0건 |
| `@acme/web/x`, `@acme/web/a.b/x`, `@acme/web/x.test`, `@acme/web/x.js/y` | 0건 |
| `@acme/web/x.TS` | 0건 |
| `../x.ts`, `./x.js` | 상대 경로 묶음 1건과 확장자 묶음 1건, 모두 2건 |
| `../x` | 상대 경로 묶음 1건 |

- `*/**/*.ts` 의 `**` 는 0개의 경로 조각에도 맞습니다. 그래서 `/` 가 하나뿐인 `lit/decorators.js` 와 `#x/y.ts` 도 잡힙니다. `/` 가 없는 `chart.js` 와 `x.ts` 에는 맞지 않습니다.
- 처음 검토한 `**/*.ts` 꼴은 `/` 가 없는 `x.ts` 와 `chart.js` 에도 맞았습니다. 묶음 안의 부정으로 이름만 빼는 꼴, 곧 `**/*.js` 옆에 `!*.js` 를 둔 묶음은 위 표와 같은 결과를 냈습니다. 패턴 수가 절반인 `*/**/` 꼴을 씁니다.
- 범위가 붙은 패키지의 이름이 확장자로 끝나면 잡힙니다. `@acme/chart.js` 는 `/` 가 있어서 경로와 구분되지 않습니다.
- 패턴은 대소문자를 구분합니다. `x.TS` 는 잡히지 않습니다.
- `.d.ts` 는 `.ts` 로 잡힙니다.
- 상대 경로에 확장자까지 붙은 경로는 두 묶음이 따로 보고해 2건이 됩니다. 기존 위반 예시 `relative-import.ts` 의 경로에는 확장자가 없어서, 기대 수 8건은 바뀌지 않습니다.

문법마다 `@acme/web/x.ts` 를 넣어 확인한 결과는 다음과 같습니다.

- 보고함: `import`, `import type`, `export { x } from`, `export * from`, `import("@acme/web/x.ts")`
- 보고하지 않음: `import("@acme/web/x.ts").T` 타입, `vi.mock("@acme/web/x.ts")`, `import.meta.glob("@acme/web/pages/*.ts")`. glob 패턴은 확장자가 있어야 하므로 보고하지 않는 것이 맞습니다.

쓰는 저장소가 자기 `biome.json` 에 `style/noRestrictedImports` 의 옵션을 적으면 다음과 같이 됩니다. `"../x"`, `"@acme/web/x.ts"`, `"lodash"`, `"lit/decorators.js"`, `"chart.js"` 를 가져오는 파일로 확인했습니다.

| 쓰는 저장소의 설정 | 남는 진단 |
|---|---|
| 적지 않음 | 상대 경로, 확장자 2건 |
| 최상위 `linter.rules` 에 `paths` 로 `lodash` 를 막음 | 상대 경로, 확장자 2건, `lodash` |
| 최상위 `linter.rules` 에 `patterns` 로 `lodash` 를 막음 | `lodash` 만 |
| `overrides` 에 `paths` 로 `lodash` 를 막음 | `lodash` 만 |
| `overrides` 에 `patterns` 로 `lodash` 를 막음 | `lodash` 만 |
| 최상위에 공용 설정의 두 묶음을 옮겨 적고 확장자 묶음에 `"!lit/decorators.js"` 를 더함 | 상대 경로, `@acme/web/x.ts` |

최상위의 `paths` 만 공용 설정의 `patterns` 옆에 더해지고, 나머지는 공용 설정의 묶음을 덮습니다. 이 동작을 설명한 Biome 문서는 찾지 않았습니다. 어느 설정에서도 `chart.js` 는 보고되지 않았습니다.

Node 가 확장자 없는 경로를 푸는 방법을 실행해 확인했습니다.

- `package.json` 에 `"imports": { "#x/*": "./src/x/*.ts" }` 를 두면, `node src/main.ts` 가 `import { greeting } from "#x/greeting"` 을 `./src/x/greeting.ts` 로 풀어 실행했습니다.
- `tsconfig.json` 의 `paths` 만 두고 `@acme/tools/x/greeting` 으로 가져오면, `tsc` 는 오류 없이 끝났지만 `node` 는 `ERR_MODULE_NOT_FOUND` 로 실패했습니다. Node 는 실행할 때 `tsconfig.json` 의 `paths` 를 읽지 않습니다.

검사의 결과는 다음과 같습니다.

- `npm test` 의 31건이 모두 통과했습니다. 이 RFC 전의 30건에 위반 예시 1건이 더해졌습니다. `npm run typecheck` 는 오류 없이 끝났고, `npm run test:flow` 는 24건이 모두 통과했습니다.
- `import-with-extension.ts` 는 error 16건, 규칙에 맞는 예시는 0건입니다.

설정을 일부러 고쳐 검사가 실패하는 것을 확인했습니다. 저장소를 `$TMPDIR` 에 복사해 한 곳씩 고치고 `node --test test/shared-config.test.ts` 를 실행했습니다. 모든 경우에 해당 검사 1건만 실패하고 30건은 통과했습니다.

| 고친 곳 | 실패한 검사 |
|---|---|
| `*/**/*.ts` 를 지움 | `import-with-extension.ts`, 16건 대신 14건 |
| `*/**/*.js` 를 `*/**/*.js-never` 로 바꿈 | `import-with-extension.ts`, 16건 대신 14건 |
| `*/**/*.js` 를 `**/*.js` 로 되돌려 이름만 있는 패키지도 잡게 함 | 규칙에 맞는 예시 검사, `chart.js` 가 보고됨 |
| 확장자 묶음에 `*/**/*.json`, `*/**/*.css` 를 더함 | 규칙에 맞는 예시 검사, `imports.ts` 의 `.css` 1건과 `.json` 2건이 보고됨 |

확인하지 않은 것은 다음과 같습니다.

- 쓰는 저장소의 지금 코드에 확장자를 붙인 import 가 몇 건 있는지 재지 않았습니다.
- 번들러가 확장자 없는 별칭 경로를 푸는지는 Vite 프로젝트를 만들어 확인하지 않았습니다.
- Biome 2.5.15 가 아닌 버전에서는 실행하지 않았습니다.

## 쓰는 저장소에 미치는 영향

지금 통과하는 코드 가운데 다음 코드가 이 변경 뒤에 실패합니다.

- 경로 끝에 `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, `.tsx` 를 붙인 import 와 `export … from`: 확장자를 지웁니다.
  - 번들러와 TypeScript 가 푸는 코드는 `tsconfig` 의 `paths` 에 선언한 별칭으로 가져옵니다.
  - Node 가 직접 실행하는 코드는 `tsconfig` 의 `paths` 로 풀리지 않습니다. 상대 경로 없이 확장자 없는 경로로 가져오려면 `package.json` 의 `imports` 에 `"#x/*": "./src/x/*.ts"` 처럼 확장자를 붙여 주는 대응을 선언하고 `#x/...` 로 가져옵니다.
- 이름이 `.js` 로 끝나는 패키지를 이름 그대로 가져오는 `import "chart.js"` 는 실패하지 않습니다.
- 확장자를 붙여야 하는 패키지의 하위 경로(`lit/decorators.js`)와, 범위가 붙은 패키지의 이름이 확장자로 끝나는 경우(`@acme/chart.js`)는 실패합니다. 공용 설정에는 이런 경로의 예외를 두지 않습니다. 억제 주석은 `no-suppression-comment` 플러그인이 막고, `overrides` 에 옵션을 적으면 상대 경로 묶음이 사라집니다. 이런 경로를 쓰는 저장소는 자기 `biome.json` 의 최상위 `linter.rules.style.noRestrictedImports` 에 공용 설정의 두 묶음을 그대로 옮겨 적고, 확장자 묶음에 `"!lit/decorators.js"` 처럼 `!` 로 시작하는 예외를 더합니다. 이렇게 적으면 그 경로만 빠지고 나머지는 그대로 잡히는 것을 실행해 확인했습니다. 옮겨 적은 묶음은 공용 설정이 바뀌어도 따라 바뀌지 않으므로, 패키지의 버전을 올릴 때 다시 맞춥니다.
- 다른 패키지의 내부 경로를 막는 규칙을 자기 `biome.json` 에 둔 저장소는 그 규칙을 `paths` 로 적었는지 확인합니다. `patterns` 로 적었거나 `overrides` 에 적었다면, 지금도 공용 설정의 상대 경로 묶음이 꺼져 있고 이 RFC 의 확장자 묶음도 받지 못합니다.

## 이전 제안

`biome-shared-config.md`: 그 RFC 가 넣은 `style/noRestrictedImports` 의 `patterns` 에 확장자 묶음을 더합니다. 그 RFC 는 쓰는 저장소가 다른 패키지의 내부 경로를 막는 규칙을 자기 `biome.json` 에 두라고 적었습니다. 그 규칙을 `patterns` 나 `overrides` 로 적으면 공용 설정의 묶음이 덮인다는 것을 이 RFC 의 근거에 적었습니다.
