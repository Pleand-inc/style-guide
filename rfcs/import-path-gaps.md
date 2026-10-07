# 내장 규칙이 보지 못하는 상대 경로를 플러그인 두 개로 막습니다

## 바꾸는 것

지금 `biome/shared.json` 은 상대 경로 가져오기를 `style/noRestrictedImports` 하나로 막습니다. 이 규칙은 `import`, `import type`, `export … from`, 문자열 리터럴 하나를 받은 `import()` 의 네 문법만 봅니다. 이 RFC 뒤에는 플러그인 두 개가 다음 여섯 형태도 오류로 보고합니다.

| 형태 | 예 | 플러그인 |
|---|---|---|
| 타입 위치의 `import()` | `import("./g").G`, `typeof import("../h")` | `no-relative-module-paths` |
| 앞머리가 상대 경로인 템플릿 리터럴을 받은 `import()` | `` import(`./f`) `` | `no-relative-module-paths` |
| 앞머리가 상대 경로인 문자열 결합을 받은 `import()` | `import("../" + "t")` | `no-relative-module-paths` |
| Vitest 의 모듈 경로 | `vi.mock("./n")`, `vi.importActual("./a")` | `no-relative-module-paths` |
| `import.meta.glob` | `import.meta.glob("./p/*.ts")` | `no-relative-module-paths` |
| 별칭 경로 안의 `./`, `../` | `"@acme/web/app/../workers/handler"` | `no-dot-segments-in-module-paths` |

`biome/plugins/no-relative-module-paths.grit` 는 표의 처음 다섯 형태를 잡습니다.

- 타입 위치의 `import()` 와 Vitest 호출은 경로가 `./` 나 `../` 로 시작하거나 경로가 `.`, `..` 이면 보고합니다. `style/noRestrictedImports` 에 준 묶음 `.`, `..`, `./**`, `../**` 와 같은 범위입니다.
- 식으로 만든 경로는 정적으로 확인할 수 없어서, 앞머리가 상대 경로인 경우만 막습니다. `import()` 의 첫 인자가 `` `./ `` 나 `` `../ `` 로 시작하는 템플릿 리터럴이거나, `./` 나 `../` 로 시작하는 문자열 뒤에 `+` 가 오면 보고합니다. `import(name)`, `` import(`@acme/web/${name}`) ``, `import("@acme/" + name)` 은 보고하지 않습니다. 동적 `import()` 자체를 막을지는 별도 RFC 의 몫입니다.
- Vitest 호출은 `vi.mock`, `vi.doMock`, `vi.unmock`, `vi.doUnmock`, `vi.importActual`, `vi.importMock` 입니다. 타입 인자를 붙인 호출과 두 번째 인자로 팩토리를 넘긴 호출도 잡습니다.
- `import.meta.glob` 은 첫 인자인 패턴만 봅니다. 배열로 준 패턴과 `!` 로 시작하는 제외 패턴도 봅니다. 두 번째 인자의 `base` 는 보지 않습니다. Vite 가 `base` 에 별칭을 받지 않기 때문입니다.

`biome/plugins/no-dot-segments-in-module-paths.grit` 는 `import … from` 과 `export … from` 의 경로를 봅니다. 경로 중간에 `/./` 나 `/../` 가 있거나 경로가 `/.`, `/..` 로 끝나면 보고합니다. `.` 으로 시작하는 경로는 `style/noRestrictedImports` 가 이미 보고하므로 보지 않습니다.

`biome/shared.json` 의 `plugins` 에 두 파일을 기존 플러그인과 같은 `./node_modules/@pleand-inc/style-guide/biome/plugins/…` 형태로 더합니다. 쓰는 저장소가 플러그인 하나를 끄는 방법은 "쓰는 저장소에 미치는 영향" 에 적었습니다.

`new URL(경로, import.meta.url)` 의 상대 경로는 막지 않습니다. 브라우저 코드만 가진 저장소는 자기 `biome.json` 의 `plugins` 에 `includes` 로 범위를 좁힌 플러그인을 더해 막을 수 있습니다. 막지 않는 이유는 "근거" 에, 더하는 방법은 "쓰는 저장소에 미치는 영향" 에 적었습니다.

진단 메시지는 다음과 같습니다.

| 형태 | 메시지 |
|---|---|
| 타입 위치의 `import()` | This import() type takes a relative path. Import through the alias declared in tsconfig paths instead. |
| 앞머리가 상대 경로인 `import()` | This dynamic import() builds a relative path. Import through the alias declared in tsconfig paths instead. |
| Vitest 호출 | This vi.mock, vi.doMock, vi.unmock, vi.doUnmock, vi.importActual or vi.importMock call takes a relative path. Import through the alias declared in tsconfig paths instead. |
| `import.meta.glob` | This import.meta.glob() takes a relative pattern. Import through the alias declared in tsconfig paths instead. |
| 별칭 경로 안의 `./`, `../` | This module path has a ./ or ../ segment after the alias. Write the path from the alias without dot segments. |

## 이유

규칙 문서의 "가져오기 경로" 는 `./` 나 `../` 로 시작하는 상대 경로를 쓰지 않고, tsconfig `paths` 에 선언한 별칭으로 가져온다고 정합니다. 지금 설정은 이 규칙을 `style/noRestrictedImports` 로 거는데, 이 규칙은 위의 네 문법만 봅니다. 번들러와 테스트 도구는 표의 형태도 모듈 경로로 풉니다. 그래서 이 형태로 쓴 상대 경로는 규칙을 어기면서 lint 를 통과합니다.

별칭 경로 안의 `..` 는 별칭으로 시작하지만 다른 폴더로 올라갑니다. 규칙 문서는 `@acme/<폴더 이름>/` 뒤에 그 폴더 안의 경로를 적는다고 정합니다. 그래서 `"@acme/web/app/../workers/handler"` 는 `"@acme/web/workers/handler"` 로 적어야 합니다.

`biome-shared-config.md` 가 정한 대로, 내장 규칙이 잡지 못하는 규칙은 GritQL 플러그인으로 겁니다.

## 근거

2026-10-07 에 Node 26.10.0 과 Biome 2.5.15 로 실행했습니다.

- `npm test` 의 26건이 모두 통과했습니다. 이 RFC 전의 20건에 위반 예시 6건이 더해졌습니다.
- `test/fixtures/biome/violations/` 에 형태마다 파일을 하나씩 두었습니다. 검사는 파일마다 그 플러그인의 진단만 정해진 수만큼 나오는지 확인합니다. `relative-import-type.ts` 3건, `dynamic-import-template.ts` 1건, `dynamic-import-concatenation.ts` 1건, `relative-vi-mock.ts` 7건, `relative-import-meta-glob.ts` 3건, `dot-segment-module-path.ts` 2건입니다.
- `relative-import.ts` 에 `"../../grandparent"` 를 가져오는 줄을 더해 기대 수를 7건에서 8건으로 바꿨습니다. 이 파일에서는 `style/noRestrictedImports` 의 진단만 나와야 합니다. 그래서 별칭 경로 플러그인이 상대 경로를 한 번 더 보고하지 않는 것을 이 파일이 확인합니다.
- `test/fixtures/biome/conforming/imports.ts` 에 플러그인이 보고하지 않아야 하는 코드를 더했습니다. 진단은 0건입니다.
  - 별칭을 쓴 타입 위치의 `import()`, `import()`, import attributes 를 붙인 `import()`
  - `import(name)` 과 별칭으로 시작하는 템플릿 리터럴의 `import()`
  - 타입 인자를 붙인 `vi.importActual`, `vi.mock`, 별칭 패턴의 `import.meta.glob`
  - 절대 URL 을 받은 `new URL(…, import.meta.url)`
- `vitest` 가 설치되지 않은 폴더에서도 `import { vi } from "vitest"` 는 진단을 내지 않았습니다.
- `npm run typecheck` 는 오류 없이 끝났고, `npm run test:flow` 는 24건이 모두 통과했습니다.
- `npm pack --dry-run` 의 목록에 두 플러그인 파일이 들어 있습니다.

플러그인을 일부러 고쳐 검사가 실패하는 것을 확인했습니다. 저장소를 `$TMPDIR` 에 복사해 플러그인 한 곳씩 고치고 `node --test test/shared-config.test.ts` 를 실행했습니다. 검사는 복사본을 `npm pack` 으로 묶어 임시 폴더에 설치한 뒤 Biome 을 실행합니다. 모든 경우에 해당 검사 1건만 실패하고 25건은 통과했습니다.

| 고친 곳 | 실패한 검사 |
|---|---|
| 동적 `import()` 갈래에서 문자열 결합을 뺌 | `dynamic-import-concatenation.ts`, 1건 대신 0건 |
| 동적 `import()` 갈래가 모든 템플릿 리터럴을 잡게 넓힘 | conforming 검사, 별칭 템플릿 리터럴이 보고됨 |
| Vitest 갈래에서 `importActual` 을 뺌 | `relative-vi-mock.ts`, 7건 대신 6건 |
| 타입 위치 갈래에서 `typeof` 를 뺌 | `relative-import-type.ts`, 3건 대신 2건 |
| 별칭 경로 플러그인에서 `.` 으로 시작하는 경로의 제외를 뺌 | `relative-import.ts`, 플러그인 진단이 1건 더 나옴 |

`new URL(경로, import.meta.url)` 을 막지 않는 이유는 다음과 같습니다.

- Vite 는 `.` 으로 시작하지 않는 경로를 자기 resolver 로 풀지만, 이 변환은 `consumer === "client"` 인 환경에만 적용됩니다. `packages/vite/src/node/plugins/assetImportMetaUrl.ts` 의 `applyToEnvironment` 에 이 조건이 있습니다.
- Vite 가 변환하지 않는 코드에서는 별칭이 그대로 URL 로 풀립니다. Node 스크립트, Workers, SSR, Node 에서 도는 테스트가 여기에 듭니다. `node -e 'console.log(new URL("@acme/web/assets/o.png", "file:///repo/apps/web/app/x.ts").href)'` 는 `file:///repo/apps/web/app/@acme/web/assets/o.png` 를 출력합니다.
- 그래서 서버 코드에는 상대 경로 대신 쓸 형태가 없습니다.

실행해서 확인한 Biome Grit 의 성질은 다음과 같습니다. 플러그인의 모양은 이 성질에 맞춘 것입니다.

- 정규식은 노드의 텍스트 전체에 맞아야 합니다. 그래서 패턴 끝에 `.*` 를 붙이고, 줄바꿈을 넘어야 하는 곳에는 `(?s)` 를 붙입니다.
- 정규식 안의 잡는 괄호 `( )` 는 메타변수로 읽힙니다. 플러그인은 `regex pattern matched 1 variables, but expected 0` 을 정보 진단으로 내고 아무것도 잡지 않으며, lint 는 통과합니다. 그래서 묶음은 `(?:…)` 로 씁니다.
- `\s` 는 공백에 맞았습니다. 괄호 뒤에 공백을 둔 `` import( `./s`) `` 도 보고되었습니다.
- 코드 조각 패턴 `` `vi.$method($path)` `` 에서 `$path` 는 인자가 둘 이상이면 인자 목록 전체에 맞았습니다. 그래서 팩토리를 여러 줄로 쓴 호출은 `(?s)` 가 없으면 빠집니다. 이 코드 조각은 타입 인자를 붙인 `vi.importActual<T>("./a")` 에 맞지 않았습니다. 그래서 Vitest 와 `import.meta.glob` 은 코드 조각 대신 `JsCallExpression(callee, arguments)` 노드로 찾고, 괄호를 포함한 인자 목록의 텍스트에 정규식을 겁니다.
- 갈래 여러 개를 최상위 `or { … }` 하나로 묶으면 갈래마다 따로 진단을 냅니다.
- 문자열 리터럴 하나를 받은 `import()` 는 두 번째 인자가 있어도 `style/noRestrictedImports` 가 상대 경로를 보고합니다. 예: `import("./data.json", { with: { type: "json" } })`.
- 문자열과 변수를 이어 붙인 `"./" + name` 과 `"@acme/" + name` 은 `style/useTemplate` 도 보고합니다. 그래서 위반 예시는 문자열끼리 이어 붙인 `"../" + "widget"` 을 쓰고, `"@acme/" + name` 은 conforming 예시에 넣지 않았습니다. `"@acme/" + name` 을 플러그인이 보고하지 않는 것은 따로 실행해 확인했습니다.
- `vi.mock(import("./widgets"))` 는 `style/noRestrictedImports` 만 보고합니다. `vi.fn("./x")`, `vi.mocked("./x")`, 팩토리가 돌려주는 객체 안의 `"./x"` 는 보고하지 않았습니다.

읽은 문서와 소스는 다음과 같습니다. 2026-10-07 에 받았고, Vite 와 Vitest 는 `main` 브랜치입니다.

- Vite `docs/guide/features.md` 의 Glob Import 절: https://raw.githubusercontent.com/vitejs/vite/main/docs/guide/features.md
  - glob 패턴은 상대 경로, 절대 경로, 별칭 경로를 받습니다.
  - `base` 옵션은 별칭을 받지 않고, 상대 경로인 패턴에만 적용됩니다.
- Vite `docs/guide/assets.md` 의 `new URL(url, import.meta.url)` 절은 상대 경로만 예로 듭니다: https://raw.githubusercontent.com/vitejs/vite/main/docs/guide/assets.md
- Vite `packages/vite/src/node/plugins/assetImportMetaUrl.ts`: https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/plugins/assetImportMetaUrl.ts
- Vitest `docs/api/vi.md` 는 `vi.mock` 의 경로에 Vite 별칭을 쓸 수 있다고 적습니다: https://raw.githubusercontent.com/vitest-dev/vitest/main/docs/api/vi.md
- 노드와 필드 이름은 Biome 2.5.15 태그의 `xtask/codegen/js.ungram` 에서 확인했습니다: https://raw.githubusercontent.com/biomejs/biome/%40biomejs/biome%402.5.15/xtask/codegen/js.ungram

잡지 않는 형태는 다음과 같습니다. 각 형태를 실행해 플러그인의 진단이 없는 것을 확인했습니다.

- `new URL("./o.ts", import.meta.url)`
- `import(name)`, `` import(`@acme/web/${name}`) ``, `import("@acme/" + name)`
- `import(".." + "/t")` 처럼 앞머리 문자열이 `./` 나 `../` 로 끝나지 않는 결합
- `require("./c")` 와 `import.meta.resolve("./d")`
- `import()` 와 타입 위치 `import()` 의 별칭 경로 안에 든 `./`, `../`. 예: `import("@acme/web/app/../x")`. 별칭 경로 플러그인은 `import … from` 과 `export … from` 의 경로만 봅니다.
- `vi` 를 다른 이름으로 가져와 부른 호출. 예: `import { vi as v } from "vitest"` 뒤의 `v.mock("./x")`. Vitest 갈래는 이름이 `vi` 인 객체만 찾습니다.

`import.defer("./x")` 와 `import.source("./y")` 는 `style/noRestrictedImports` 가 보고하고, 플러그인은 보고하지 않았습니다.

확인하지 않은 것은 다음과 같습니다.

- Vite 프로젝트를 만들어 별칭 패턴의 `import.meta.glob` 을 빌드해 보지 않았습니다. Vite 의 문서만 읽었습니다.
- `import.meta.glob` 의 패턴을 상대 경로에서 별칭으로 바꾸면 결과 객체의 키가 어떻게 바뀌는지 확인하지 않았습니다.
- Vitest 에서 별칭으로 `vi.mock` 한 테스트를 실행해 보지 않았습니다.
- Biome 2.5.15 가 아닌 버전에서는 실행하지 않았습니다.

## 쓰는 저장소에 미치는 영향

지금 통과하는 코드 가운데 다음 코드가 이 변경 뒤에 실패합니다.

- 타입 위치의 `import("./x")` 와 `typeof import("../x")`: `import("@acme/web/x").X` 처럼 별칭으로 적습니다.
- 앞머리가 상대 경로인 템플릿 리터럴과 문자열 결합을 받은 `import()`: 앞머리를 별칭으로 적습니다. `` import(`./pages/${name}`) `` 는 `` import(`@acme/web/pages/${name}`) `` 로 적습니다.
- `vi.mock("./x")` 와 같은 Vitest 호출: 경로를 별칭으로 적습니다. 쓰는 저장소의 Vitest 설정이 tsconfig `paths` 의 별칭을 풀어야 합니다.
  - `vi.mock(import("./x"))` 형태는 지금도 `style/noRestrictedImports` 가 막고 있어서 이 RFC 로 바뀌지 않습니다.
  - Vitest 문서는 이 형태에 tsconfig `paths` 의 별칭을 쓰면 컴파일러가 타입을 풀지 못한다고 적습니다.
- `import.meta.glob("./x/*.ts")`: 패턴을 별칭으로 적습니다. `base` 옵션은 상대 경로인 패턴에만 적용되므로, 패턴을 별칭으로 바꾸면 `base` 는 효과를 잃습니다. 결과 객체의 키를 쓰는 코드는 바꾼 뒤에 다시 확인합니다.
- 별칭 경로 안의 `./`, `../`: `"@acme/web/app/../workers/handler"` 는 `"@acme/web/workers/handler"` 로 적습니다.

`new URL(경로, import.meta.url)` 의 상대 경로를 막으려는 저장소는 자기 플러그인을 더합니다. 아래 방법은 실행해서 확인했습니다. 쓰는 저장소가 적은 `plugins` 는 받은 목록 뒤에 더해집니다.

```grit
engine biome(1.0)
language js(typescript, jsx)

`new URL($path, import.meta.url)` where {
    $path <: r"(?s)[\"'`]\.\.?[/\"'`].*",
    register_diagnostic(
        span = $path,
        message = "This new URL(path, import.meta.url) takes a relative path. Import through the alias declared in tsconfig paths instead."
    )
}
```

```json
{
  "extends": ["@pleand-inc/style-guide/biome"],
  "overrides": [
    {
      "includes": ["src/client/**"],
      "plugins": ["./biome/no-relative-new-url.grit"]
    }
  ]
}
```

- 이 설정은 `src/client/` 아래 파일만 보고하고 `src/server/` 아래 파일은 보고하지 않았습니다.
- 플러그인 항목의 `includes` 로 범위를 좁힐 때는 glob 을 확인합니다. `{ "path": …, "includes": ["src/client/**"] }` 는 아무 파일에도 맞지 않았고, `["**/client/**"]` 는 맞았습니다.
- 브라우저 코드만 가진 저장소는 `includes` 없이 `plugins` 에 그 파일을 적습니다.

플러그인 하나만 끄는 방법은 다음과 같습니다. 모두 실행해서 확인했고, 이 동작을 설명한 Biome 문서는 찾지 않았습니다.

- 쓰는 저장소의 `biome.json` 에 `plugins` 를 적어도 받은 플러그인은 꺼지지 않습니다. `"plugins": []` 로 적어도 두 플러그인이 모두 돌았습니다.
- `overrides` 에 같은 경로의 플러그인을 `"includes": ["!**"]` 로 적으면 그 플러그인만 꺼집니다. 다음 설정은 `src/` 아래에서 별칭 경로 플러그인만 끕니다. 두 플러그인 모두 이 방법으로 하나씩 꺼지는 것을 확인했습니다.

  ```json
  {
    "extends": ["@pleand-inc/style-guide/biome"],
    "overrides": [
      {
        "includes": ["src/**"],
        "plugins": [
          {
            "path": "./node_modules/@pleand-inc/style-guide/biome/plugins/no-dot-segments-in-module-paths.grit",
            "includes": ["!**"]
          }
        ]
      }
    ]
  }
  ```

- 파일 하나에서는 파일 맨 위에 `// biome-ignore-all lint/plugin/<파일 이름>: <이유>` 를 둡니다. 예를 들어 `// biome-ignore-all lint/plugin/no-dot-segments-in-module-paths: <이유>` 는 그 파일에서 별칭 경로 플러그인만 끕니다.

## 이전 제안

`biome-shared-config.md`: 그 RFC 가 넣은 `biome/shared.json` 의 `plugins` 에 두 파일을 더합니다. 그 RFC 는 `\s` 와 괄호 묶음을 쓴 패턴이 맞지 않았다고 적었습니다. 이번 확인에서는 `\s` 가 공백에 맞았고, 괄호 묶음은 `(?:…)` 로 쓰면 맞았습니다. 잡는 괄호 `( )` 는 위 근거에 적은 오류를 냅니다.
