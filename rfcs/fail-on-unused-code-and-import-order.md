# 미사용 코드를 오류로 올리고 import 순서를 공용 설정에 적습니다

## 바꾸는 것

지금 `biome/shared.json` 은 미사용 코드 규칙 셋을 Biome 권장 규칙의 기본 심각도인 warn 으로 받습니다. import 순서는 공용 설정에 적혀 있지 않고, Biome 이 기본으로 켜는 assist 동작에 맡겨져 있습니다. 이 RFC 뒤에는 다음과 같습니다.

| 규칙 | Biome 의 이름 | 지금 | 이 RFC 뒤 |
|---|---|---|---|
| 미사용 변수 | `correctness/noUnusedVariables` | 권장 규칙의 기본값 warn | `error` |
| 미사용 import | `correctness/noUnusedImports` | 권장 규칙의 기본값 warn | `error` |
| 미사용 함수 인자 | `correctness/noUnusedFunctionParameters` | 권장 규칙의 기본값 warn | `error` |
| import 순서 | `assist.actions.source.organizeImports` | 적지 않음, Biome 기본값으로 켜짐 | `"on"` |

문서는 다음처럼 바뀝니다.

- `rules/RULES.md` 의 작성 가이드에 "가져오기 순서" 한 줄을 더합니다. `import` 문과 `export … from` 문은 Biome 의 organizeImports 가 정하는 순서로 적는다는 문장입니다.
- `README.md` 에 "검사" 절을 더합니다. 쓰는 저장소의 검사 게이트는 `biome check` 로 돌리고, 포맷과 import 순서는 `biome check --write` 로 고친다고 적습니다. CI 에서는 `biome ci` 를 써도 같은 진단을 내고, `biome ci` 는 파일을 고치지 않는다고 적습니다.

검사 `test/shared-config.test.ts` 는 다음처럼 바뀝니다.

- 위반 예시 검사는 진단의 규칙 이름과 수에 더해, 진단의 심각도가 모두 `error` 이고 `biome lint` 의 exit code 가 1 인지 확인합니다. 지금 검사는 규칙 이름과 수만 봐서, 규칙이 warn 으로 내려가도 통과합니다.
- 위반 예시 `unused-import.ts`, `unused-variable.ts`, `unused-parameter.ts` 를 더합니다. 파일마다 그 규칙의 error 1건입니다.
- 위반 예시 `unsorted-imports.ts` 를 더합니다. `biome check` 는 `assist/source/organizeImports` error 1건을 내고 exit code 1 로 끝나야 합니다. `biome lint` 는 진단 없이 exit code 0 으로 끝나야 합니다.
- 규칙에 맞는 예시 `conforming/unused-parameter.ts` 를 더합니다. 쓰지 않는 첫 인자의 이름을 `_unused` 로 적은 함수입니다. 규칙에 맞는 예시 검사는 진단 0건에 더해 exit code 0 을 확인합니다.

## 이유

미사용 코드 규칙 셋의 기본 심각도는 warn 입니다. warn 진단만 있으면 `biome lint` 와 `biome check` 는 exit code 0 으로 끝납니다. 그래서 지금 설정으로는 미사용 import 가 든 코드가 게이트를 통과합니다. 이 설정을 쓰는 저장소 하나는 ESLint 를 지우기 전에 `no-unused-vars` 를 error 로 걸고 있었습니다. 같은 수준을 공용 설정에서 지킵니다.

import 순서는 `biome check` 만 확인합니다. `biome lint` 는 assist 동작을 돌리지 않고, `biome format` 도 순서를 보지 않습니다. 그래서 게이트가 `biome lint` 와 `biome format` 을 따로 돌리면 순서가 틀린 코드가 통과합니다. 게이트를 `biome check` 로 돌리면 편집기에서 Biome 확장이 보여 주는 결과와 맞출 수 있다는 것이 쓰는 저장소의 요청입니다. 확장의 동작은 이 RFC 에서 확인하지 않았습니다.

organizeImports 는 지금도 Biome 의 기본값으로 켜져 있습니다. 공용 설정에 `"on"` 으로 적는 것은 Biome 의 기본 assist 묶음에 기대지 않고 이 설정이 import 순서를 켠다는 것을 밝히기 위해서입니다. 값을 적어 두어야 검사가 그 값을 고정할 수 있습니다.

## 근거

2026-10-07 에 Node 26.10.0 과 Biome 2.5.15 로 실행했습니다. 검사는 이전 RFC 들과 같이 패키지를 `npm pack` 으로 묶어 임시 폴더의 `node_modules` 에 풀고, 그 폴더에서 `extends` 로 설정을 받아 실행했습니다.

- `biome explain noUnusedVariables`, `biome explain noUnusedImports`, `biome explain noUnusedFunctionParameters` 는 세 규칙 모두 `correctness` 묶음이고, 기본 심각도가 warn 이며, 권장 규칙이라고 출력합니다.
- 이 RFC 전의 설정으로 미사용 import 하나가 든 파일을 검사했습니다. `biome lint` 와 `biome check` 모두 severity `warning` 진단 1건을 내고 exit code 0 으로 끝났습니다. 진단의 이름은 error 일 때와 같은 `lint/correctness/noUnusedImports` 입니다. 그래서 이름과 수만 보는 지금 검사로는 warn 과 error 를 구분할 수 없습니다.
- 이 RFC 뒤의 설정으로 같은 파일을 검사하면 severity `error` 1건이 나오고 exit code 는 1 입니다.
- 기존 위반 예시 18개는 `biome lint` 와 `biome check` 에서 모든 진단이 error 이고 exit code 가 1 이었습니다. 그래서 심각도와 exit code 확인을 더해도 기존 기대값은 바뀌지 않습니다.
- `npm test` 의 30건이 모두 통과했습니다. 이 RFC 전의 26건에 위반 예시 3건과 import 순서 검사 1건이 더해졌습니다. `npm run typecheck` 는 오류 없이 끝났고, `npm run test:flow` 는 24건이 모두 통과했습니다.

`_` 로 시작하는 이름은 다음과 같이 동작합니다.

- 인자 `_unused` 와 변수 `_count` 는 보고되지 않았습니다. `biome explain` 도 `noUnusedVariables` 와 `noUnusedFunctionParameters` 에 이 예외를 적습니다.
- import 에는 이 예외가 없습니다. `import { widget as _widget } from "@acme/widgets"` 와 `import _widgets from "@acme/widgets"` 는 둘 다 `noUnusedImports` 로 보고되었습니다.
- 미사용 인자는 쓰는 인자의 앞에 있어도 뒤에 있어도 보고되었습니다. `(unused, second) => second` 와 `(first, unused) => first` 가 모두 보고되었습니다. 쓰는 인자의 자리 때문에 남겨야 하는 앞 인자는 `_` 로 시작하는 이름으로 적습니다.
- 나머지 속성(`...others`)과 함께 꺼낸 이름은 쓰지 않아도 보고되지 않았습니다. `const { a, ...others } = value` 의 `a` 와 인자 `{ a, ...others }` 의 `a` 가 모두 그렇습니다. `biome explain` 은 두 규칙의 `ignoreRestSiblings` 옵션의 기본값이 `true` 라고 적습니다.

import 순서는 다음과 같이 동작합니다.

- `vitest` 를 `@acme/widgets` 보다 먼저 가져온 파일에서 `biome check` 는 `assist/source/organizeImports` error 1건을 내고 exit code 1 로 끝났습니다. `biome lint` 는 진단 0건, exit code 0 이었고, `biome format` 도 exit code 0 이었습니다.
- 이 RFC 전의 설정에서도 organizeImports 는 켜져 있었습니다. 기존 위반 예시를 `biome check` 로 돌리면 `relative-import.ts` 에서 `assist/source/organizeImports` 1건이 더 나왔습니다. 그래서 `"on"` 을 적어도 `biome check` 의 결과는 바뀌지 않습니다. 기존 위반 예시는 이 진단이 섞이지 않도록 지금처럼 `biome lint` 로 검사하고, `unsorted-imports.ts` 만 두 명령으로 검사합니다.
- `biome ci` 는 위반 예시 22개와 규칙에 맞는 예시 폴더에서 `biome check` 와 같은 진단과 exit code 를 냈습니다. `biome ci` 는 순서가 틀린 파일을 고치지 않았고, `biome ci --write` 는 "`--write` is not expected in this context" 로 거부되었습니다.

설정을 일부러 되돌려 검사가 실패하는 것을 확인했습니다. 저장소를 `$TMPDIR` 에 복사해 한 곳씩 고치고 `node --test test/shared-config.test.ts` 를 실행했습니다. 모든 경우에 해당 검사 1건만 실패하고 29건은 통과했습니다.

| 고친 곳 | 실패한 검사 |
|---|---|
| `noUnusedImports` 를 `warn` 으로 | `unused-import.ts`, 진단이 `warning` 으로 나옴 |
| `noUnusedVariables` 를 `warn` 으로 | `unused-variable.ts`, 진단이 `warning` 으로 나옴 |
| `noUnusedFunctionParameters` 를 `warn` 으로 | `unused-parameter.ts`, 진단이 `warning` 으로 나옴 |
| `organizeImports` 를 `"off"` 로 | `unsorted-imports.ts`, `biome check` 의 진단이 0건 |
| 규칙에 맞는 예시의 `_unused` 를 `unused` 로 | 규칙에 맞는 예시 검사, `noUnusedFunctionParameters` 가 보고됨 |

읽은 문서는 다음과 같습니다. 2026-10-07 에 `biomejs/website` 저장소의 `main` 브랜치에서 받았습니다.

- Assist: https://raw.githubusercontent.com/biomejs/website/main/src/content/docs/en/assist/index.mdx
  - "Assist actions can be enforced via CLI via `check` command" 와 "By default, Biome enforces assists when running the `check` command" 라고 적습니다.
- organizeImports: https://raw.githubusercontent.com/biomejs/website/main/src/content/docs/en/assist/actions/organize-imports/javascript.mdx
  - import 와 export 를 함께 정렬하고, 중괄호 안의 이름도 정렬한다고 적습니다.
  - 순서는 URL, 프로토콜이 붙은 경로, 패키지, `#` 같은 별칭, 파일 경로입니다.
- Continuous Integration: https://raw.githubusercontent.com/biomejs/website/main/src/content/docs/en/recipes/continuous-integration.mdx
  - CI 환경에서는 `biome check` 대신 `biome ci` 를 쓰라고 적습니다.
- VS Code extension: https://raw.githubusercontent.com/biomejs/website/main/src/content/docs/en/reference/vscode.mdx
  - 확장이 포맷, lint 진단, 고침을 제공하고, 저장할 때 `source.organizeImports.biome` 으로 import 를 정렬할 수 있다고 적습니다.

확인하지 않은 것은 다음과 같습니다.

- 편집기의 Biome 확장이 순서가 틀린 import 를 진단으로 보여 주는지 확인하지 않았습니다. 위 VS Code 문서는 저장할 때 정렬하는 동작만 적습니다.
- 쓰는 저장소에서 `biome check` 로 바꿨을 때 지금 코드에서 몇 건이 새로 실패하는지 재지 않았습니다.
- Biome 2.5.15 가 아닌 버전에서는 실행하지 않았습니다.

## 쓰는 저장소에 미치는 영향

게이트 명령이 바뀝니다. `biome lint` 와 `biome format` 을 따로 돌리던 게이트는 `biome check` 하나로 바꿉니다.

지금 통과하는 코드 가운데 다음 코드가 이 변경 뒤에 실패합니다.

- 미사용 import, 미사용 변수, 미사용 함수 인자: 지금은 warn 이라 통과합니다. 다음 버전을 받으면 이 코드가 남아 있는 한 게이트가 막힙니다. 버전을 올리는 pull request 에서 먼저 지웁니다.
- 순서가 틀린 import: `biome lint` 와 `biome format` 만 돌리던 저장소는 게이트를 `biome check` 로 바꾸면서 실패합니다. 이미 `biome check` 를 돌리던 저장소에서는 바뀌지 않습니다.

고치는 방법은 다음과 같습니다. 모두 실행해서 확인했습니다.

- 포맷과 import 순서는 `biome check --write` 로 고칩니다. 이 명령은 미사용 코드를 고치지 않습니다. 세 규칙의 고침은 Biome 이 unsafe 로 분류하기 때문입니다. 미사용 코드가 남아 있으면 이 명령은 exit code 1 로 끝납니다.
- 미사용 import 는 `biome lint --write --unsafe --only=correctness/noUnusedImports` 로 지울 수 있습니다. 이 명령은 미사용 import 만 지우고 다른 코드는 그대로 둡니다.
- 미사용 변수와 미사용 인자에는 `--unsafe` 고침을 쓰지 않습니다. 이 고침은 코드를 지우지 않고 이름 앞에 `_` 를 붙입니다. `count` 는 `_count` 가 되고 `unused` 는 `_unused` 가 됩니다. 규칙은 통과하지만 쓰지 않는 코드가 남습니다. 손으로 지우고, 쓰는 인자의 자리 때문에 남겨야 하는 인자만 `_` 로 시작하는 이름으로 적습니다.

## 함께 하는 정리: `recommended` 를 `preset` 으로 바꿉니다

이 정리는 규칙의 뜻과 검사 결과를 바꾸지 않습니다. 같은 pull request 에 담습니다.

- `biome/shared.json` 의 `linter.rules.recommended: true` 를 `linter.rules.preset: "recommended"` 로 바꿉니다.
- 이 RFC 전의 설정을 받은 폴더에서 `biome rage` 는 "Biome Configuration" 아래에 다음 문구를 냈습니다. "The use of the recommended field has been deprecated, and will removed in the next major version of Biome. Use preset instead." 바꾼 뒤에는 이 문구가 나오지 않습니다.
- Biome 2.5.15 의 설정 스키마에서 `$defs.Rules.preset` 은 `recommended`, `all`, `none` 가운데 하나를 받습니다. `assist.actions` 에도 `recommended` 와 `preset` 이 있지만, 공용 설정은 `assist.actions.recommended` 를 적지 않아 바꿀 것이 없습니다. organizeImports 를 더한 뒤에도 `biome rage` 에 deprecated 문구는 나오지 않았습니다.
- `biome rage --linter` 가 출력한 켜진 규칙 222개는 바꾸기 전과 후에 `diff` 결과가 같습니다. 이 비교는 미사용 규칙과 organizeImports 를 바꾸기 전에 했습니다. 바꾼 뒤 `rage --linter` 의 "Recommended" 줄은 `true` 에서 `unset` 으로 바뀝니다. 이 줄은 옛 필드의 값을 보여 줍니다.
- 이 정리만 한 상태에서 `npm test` 의 26건이 기대값을 바꾸지 않고 모두 통과했습니다.
- 쓰는 저장소가 자기 `biome.json` 에 `"recommended": false` 나 `"preset": "none"` 을 적으면, 바꾸기 전과 후 모두 공용 설정이 직접 적은 규칙 9개만 켜집니다. 쓰는 저장소에서 바뀌는 것은 없습니다.

## 이전 제안

`biome-shared-config.md`: 그 RFC 는 Biome 권장 규칙을 `recommended` 필드로 켰습니다. 이 RFC 는 같은 규칙 묶음을 `preset` 필드로 켭니다. 그 RFC 가 권장 규칙의 기본값에 맡긴 미사용 코드 규칙 셋의 심각도를 `error` 로 올리고, 적지 않았던 `assist` 의 organizeImports 를 적습니다.
