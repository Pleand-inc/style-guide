# TypeScript 공용 설정을 base, web, node 세 종류로 넣습니다

## 바꾸는 것

지금 패키지에는 TypeScript 설정이 없습니다. 이 RFC 뒤에는 패키지가 설정 세 개를 담습니다. 쓰는 저장소는 `tsconfig.json` 의 `extends` 에 아래 이름을 적어 받습니다.

| 이름 | 파일 | 쓰는 곳 |
|---|---|---|
| `@pleand-inc/style-guide/tsconfig` | `tsconfig/base.json` | 실행 환경과 무관한 엄격함 옵션 |
| `@pleand-inc/style-guide/tsconfig/web` | `tsconfig/web.json` | 번들러가 묶어 브라우저에서 도는 코드 |
| `@pleand-inc/style-guide/tsconfig/node` | `tsconfig/node.json` | Node 에서 도는 코드 |

`web` 과 `node` 는 `base` 를 받습니다.

`base` 가 켜는 옵션은 다음과 같습니다.

| 옵션 | 오류로 보고하는 코드 |
|---|---|
| `strict` | 타입을 적지 않아 `any` 가 되는 인자, `undefined` 일 수 있는 값의 속성 접근 |
| `verbatimModuleSyntax` | 타입을 `export type` 없이 내보내는 코드 |
| `erasableSyntaxOnly` | `enum` 선언 |
| `noUncheckedIndexedAccess` | 배열에서 인덱스로 꺼낸 값을 확인 없이 쓰는 코드 |
| `exactOptionalPropertyTypes` | `?` 로 선언한 속성에 `undefined` 를 넣는 코드 |

`web` 과 `node` 가 더하는 옵션은 다음과 같습니다.

| 옵션 | `web` | `node` |
|---|---|---|
| `lib` | `DOM`, `DOM.Iterable`, `ES2022` | `ES2022` |
| `jsx` | `react-jsx` | 없음 |
| `types` | 없음 | `node` |
| `target` | `ES2022` | `ES2022` |
| `module` | `ES2022` | `ES2022` |
| `moduleResolution` | `bundler` | `bundler` |
| `noEmit` | 켬 | 켬 |
| `skipLibCheck` | 켬 | 켬 |

저장소에는 다음을 함께 넣습니다.

- 저장소 루트의 `tsconfig.json`: 이 저장소의 검사 코드가 `tsconfig/node.json` 을 받아 타입 검사를 받습니다.
- `npm run typecheck` 와, 워크플로에서 `npm run typecheck` 를 실행하는 단계
- `devDependencies` 의 `typescript` 6.0.3 과 `@types/node` 26.6.4

## 이유

코드 규칙 가운데 컴파일러가 검사할 수 있는 것은 컴파일러 옵션으로 겁니다.

- `erasableSyntaxOnly` 는 `enum` 을 쓰지 않는다는 규칙을 컴파일러에서도 검사합니다. 이 저장소의 검사 코드처럼 Node 가 TypeScript 파일의 타입을 지우기만 하고 실행하는 환경에서는 `enum` 이 있는 파일이 실행되지 않습니다.
- `noUncheckedIndexedAccess` 는 인덱스로 꺼낸 값이 없을 수 있다는 것을 타입에 드러냅니다. non-null 단언을 쓰지 않는다는 규칙과 함께 쓰면, 값이 있는지 확인하는 코드가 빠졌을 때 컴파일이 실패합니다.
- `exactOptionalPropertyTypes` 는 속성이 없는 것과 속성의 값이 `undefined` 인 것을 구분합니다.

실행 환경에 따라 달라지는 옵션은 종류별 설정에 둡니다. 브라우저 코드에는 DOM 타입이 있어야 하고 Node 코드에는 없어야 합니다. Node 코드에는 `node` 타입이 있어야 하고 브라우저 코드에는 없어야 합니다. 한 설정에 둘을 함께 넣으면 다른 환경의 전역 값을 쓴 코드가 컴파일을 통과합니다.

`target`, `module`, `moduleResolution`, `noEmit`, `skipLibCheck` 의 값은 이 설정을 받을 저장소들이 지금 쓰는 값입니다.

## 근거

`npm test` 가 패키지를 `npm pack` 으로 묶어 임시 폴더의 `node_modules` 에 풀고, 그 폴더에 종류마다 `tsconfig` 파일을 하나씩 두어 `extends` 로 설정을 받아 `tsc` 를 실행합니다. 2026-10-06 에 Node 26.10.0 과 TypeScript 6.0.3 으로 실행해 20건이 모두 통과했습니다. 14건은 Biome 설정의 검사이고 6건이 이 RFC 의 검사입니다.

- `test/fixtures/typescript/base/violations/` 의 파일은 `base` 의 옵션 하나씩에 걸립니다. 오류 코드는 `TS7006`, `TS18048`, `TS1205`, `TS1294`, `TS2532`, `TS1360` 입니다.
- `test/fixtures/typescript/web/` 에서 `document` 와 `querySelectorAll` 의 결과를 `for...of` 로 도는 파일은 통과하고, `process` 를 쓰는 파일은 `TS2591` 로 실패합니다.
- `test/fixtures/typescript/node/` 에서 `process` 와 `node:fs` 를 쓰는 파일은 통과하고, `document` 를 쓰는 파일은 `TS2584` 로 실패합니다.
- 검사는 종류마다 정해진 파일에서 정해진 오류 코드 하나만 나오는지 확인합니다.
- 설정을 일부러 고쳐 검사가 실패하는 것을 확인했습니다. `web` 에서 DOM 을 빼면 `web` 의 검사가, `node` 에서 `types` 를 빼면 `node` 의 검사가, `base` 에서 `noUncheckedIndexedAccess` 를 빼면 `base` 의 검사가 실패합니다.
- `npm run typecheck` 가 이 저장소의 검사 코드를 `node` 설정으로 검사해 오류 없이 통과했습니다.

TypeScript 버전에 따라 다른 것은 다음과 같습니다. 묶은 패키지를 5.9.3 과 7.0.2 로도 실행했습니다.

- 7.0.2 는 세 종류 모두 6.0.3 과 같은 파일에서 같은 오류 코드를 냅니다.
- 5.9.3 은 `base` 와 `node` 에서 같은 결과를 냅니다. `web` 에서는 `process` 를 쓰는 파일이 통과합니다. 5.9.3 은 `types` 를 적지 않으면 설치된 `@types` 패키지를 모두 불러오기 때문입니다. `@types/node` 가 설치된 저장소에서 5.9.3 으로 `web` 을 쓰면 Node 의 전역 값이 걸러지지 않습니다.
- 6.0.3 과 7.0.2 는 `strict` 를 기본으로 켭니다. 5.9.3 에서는 `strict` 줄이 없으면 `tsc` 가 `TS5052` 로 멈춥니다. `exactOptionalPropertyTypes` 는 `strictNullChecks` 없이 켤 수 없다는 오류입니다. 그래서 `strict` 를 `base` 에 적어 둡니다.

확인하지 않은 것은 다음과 같습니다.

- `web` 의 `jsx` 는 `tsc --showConfig` 에 `react-jsx` 로 나오는 것만 확인했습니다. React 의 타입을 설치하고 JSX 파일을 검사해 보지는 않았습니다.
- `erasableSyntaxOnly` 가 `enum` 이 아닌 문법에서 내는 오류는 실행해 보지 않았습니다.
- `tsc -b` 와 프로젝트 참조를 쓰는 구성에서 `extends` 가 이어지는지 확인하지 않았습니다.
- TypeScript 문서는 읽지 않았습니다. 위 내용은 실행 결과만을 근거로 합니다.

## 쓰는 저장소에 미치는 영향

이 설정을 받는 저장소에서는 `base` 표의 코드가 컴파일 오류가 됩니다. 고치는 방법은 다음과 같습니다.

- `enum` 은 값의 목록을 `as const` 로 적고, 유니온 타입을 그 목록에 `typeof` 를 적용해 만듭니다.
- 인덱스로 꺼낸 값은 `undefined` 인지 확인한 뒤에 쓰거나 `??` 로 기본값을 줍니다.
- `?` 로 선언한 속성에 값이 없으면 `undefined` 를 넣지 않고 속성을 적지 않습니다.
- 타입만 내보낼 때는 `export type` 을 씁니다.

쓰는 저장소가 알아 둘 것은 다음과 같습니다.

- `typescript` 는 쓰는 저장소의 `devDependencies` 에 둡니다. `node` 를 받는 저장소는 `@types/node` 도 둡니다. TypeScript 는 타입 패키지를 쓰는 저장소의 `node_modules` 에서 찾습니다.
- `lib` 와 `types` 는 `extends` 에서 합쳐지지 않습니다. 쓰는 저장소가 `types` 를 적으면 받은 값이 통째로 바뀝니다. `node` 를 받고 타입 패키지를 더하려면 `node` 도 다시 적습니다.
- 한 설정이 브라우저 코드와 Worker 코드를 함께 검사하는 저장소는 `web` 을 받고, Worker 의 타입 선언 파일을 자기 `include` 에 더합니다.
