# 규칙 문서를 typescript 와 git 폴더로 묶고, 그 안을 주제별 폴더로 나눕니다

## 바꾸는 것

지금 규칙 문서는 두 곳에 있습니다. `rules/RULES.md` 에 코드 규칙 전부가 절 셋(핵심 원칙, 작성 가이드, 타입)으로 있고 `rules/EXAMPLES.md` 에 예시 전부가 있습니다. 브랜치 흐름은 `rules/` 밖의 `process/branch-flow.md` 에 있습니다.

이 RFC 뒤에는 `rules/` 아래에 폴더 둘이 있습니다. `typescript/` 는 TypeScript 코드 규칙이고, `git/` 은 브랜치 흐름과 변경 이력의 규칙입니다. 두 폴더 안에는 주제마다 폴더 하나가 있습니다. 주제 폴더의 `RULES.md` 가 그 주제의 규칙이고, `EXAMPLES.md` 가 그 주제의 예시입니다. 예시가 없는 주제에는 `EXAMPLES.md` 가 없습니다. `rules/README.md` 는 적용 범위와 폴더 목록을 적는 색인입니다. `rules/RULES.md`, `rules/EXAMPLES.md`, `process/` 폴더는 없어집니다.

| 폴더 | 주제 | 규칙 | 예시 |
|---|---|---|---|
| `typescript/principles/` | 핵심 원칙 | 중복 제거, 단일 책임, 의도 드러내기, 단순함 | 없음 |
| `typescript/naming-and-functions/` | 이름과 함수 | 의미 있는 이름, 작은 함수, 작은 단위, 삼항 연산자 | 2개 |
| `typescript/modules-and-values/` | 모듈과 값 | 가져오기 경로, 가져오기 경로의 확장자, 가져오기 순서, 스프레드 | 3개 |
| `typescript/comments/` | 주석 | 주석 | 3개 |
| `typescript/types/` | 타입 | 타입 절의 항목 가운데 아래 두 폴더로 가는 셋을 뺀 아홉 | 8개 |
| `typescript/external-input/` | 외부 입력 | zod 스키마로 검증하는 항목 | 2개 |
| `typescript/type-check-performance/` | 타입 검사 성능 | 컴파일 시간을 늘리는 네 가지 타입, `tsc --extendedDiagnostics` 로 확인하는 항목 | 없음 |
| `git/branch-flow/` | 브랜치 흐름 | `process/branch-flow.md` 의 내용 전부 | 없음 |
| `git/decision-tickets/` | 변경 이력과 티켓 | 이력, 티켓 만들기, 티켓 고치기, 티켓의 상태, 티켓 읽기 | 3개 |

규칙 문장과 예시의 내용은 바꾸지 않고 자리만 옮깁니다. 한 폴더 안에서 항목의 순서는 지금 문서에서의 순서와 같습니다. `typescript/` 아래와 `git/decision-tickets/` 의 `RULES.md` 는 주제 이름을 제목으로 두고 규칙 문장만 담습니다.

`git/branch-flow/RULES.md` 는 `process/branch-flow.md` 를 그대로 옮긴 것입니다. 코드 규칙의 자리를 가리키는 한 문장만 `rules/typescript/` 로 고칩니다. 이 문서에는 표와 절이 있고, 다른 `RULES.md` 처럼 규칙 문장만 담은 모양이 아닙니다. 모양을 맞추는 일은 문장을 다시 쓰는 일이라 이 RFC 에 넣지 않습니다.

`rules/RULES.md` 첫머리의 두 문단은 `rules/README.md` 로 옮기면서 고쳐 씁니다.

- 범위 문장은 여섯 항목의 이름을 하나씩 적는 대신 폴더 이름을 적습니다. 여섯 항목은 `typescript/comments/` 와 `git/decision-tickets/` 로 가므로 가리키는 항목은 같습니다.
  - 지금: 작성 가이드의 주석, 이력, 티켓 만들기, 티켓 고치기, 티켓의 상태, 티켓 읽기 항목은 `apps/`, `packages/`, `scripts/` 아래의 JavaScript 파일과 주석을 쓸 수 있는 설정 파일에도 적용합니다.
  - 이 RFC 뒤: `typescript/comments/` 의 규칙은 `apps/`, `packages/`, `scripts/` 아래의 JavaScript 파일과 주석을 쓸 수 있는 설정 파일에도 적용합니다. `git/decision-tickets/` 의 규칙은 TypeScript 코드와, `apps/`, `packages/`, `scripts/` 아래의 JavaScript 파일과 주석을 쓸 수 있는 설정 파일에 적용합니다.
- 예시 문서를 가리키던 문단과 `rules/EXAMPLES.md` 의 머리말은 `rules/README.md` 의 한 문단으로 합칩니다. 예시가 컴파일되는 코드라는 문장과 어긋난 코드도 컴파일은 된다는 문장은 그대로 둡니다.

경로를 적은 다른 곳도 함께 고칩니다.

- `cli/lib/templates.mjs` 의 `skillFile` 이 만드는 스킬은 브랜치 흐름 문서를 `rules/git/branch-flow/RULES.md` 로 가리킵니다. 규칙 파일 목록의 제목은 "코드 규칙" 에서 "규칙" 으로 바꾸고, `typescript/` 와 `git/` 이 무엇인지 한 문장으로 적습니다. 목록 자체는 지금처럼 설치된 패키지의 `rules/` 아래 파일 전부입니다.
- `package.json` 의 `files` 에서 `process` 를 뺍니다. 브랜치 흐름 문서는 `rules` 에 실려 나갑니다.
- 저장소 루트의 `README.md` 의 표와 브랜치 흐름 절이 적은 경로를 새 경로로 고칩니다.

## 이유

저장소 관리자가 `rules/` 가 너무 평평하다고 했고, 규칙을 `rules/` 아래의 폴더로 묶어 관리하기를 요청했습니다. 처음 안은 주제 폴더 일곱 개를 `rules/` 바로 아래에 나란히 두는 것이었습니다. 저장소 관리자는 그 안을 보고 두 가지를 짚었습니다. TypeScript 에 대한 규칙이 폴더 여럿으로 잘려 있는데 어느 폴더 이름에도 TypeScript 라는 말이 없다는 것과, git 에 대한 규칙이 따로 있다는 것입니다.

- 주제 폴더만 나란히 두면 이 패키지가 TypeScript 코드 규칙과 git 규칙을 함께 싣는다는 것이 `rules/` 에서 드러나지 않습니다. `types/`, `external-input/`, `type-check-performance/` 는 이름만으로는 무엇의 규칙인지 알 수 없습니다.
- git 에 대한 규칙이 두 곳에 갈라져 있었습니다. 브랜치 흐름은 `rules/` 밖의 `process/` 에 있었고, 티켓 절차는 주석 항목과 같은 절에 있었습니다. 티켓 절차는 `git hash-object`, `git mv`, `origin/develop` 브랜치로 정해지는 절차입니다.
- 종류가 다른 규칙이 한 파일에 있었습니다. 작성 가이드 절에는 코드의 모양을 정하는 항목, 모듈 경로 항목, 값 복사 항목, 주석 항목, 티켓 절차가 함께 있었습니다. 타입 절에는 타입 설계 항목, 외부 입력을 검증하는 항목, 컴파일 시간을 다루는 항목이 함께 있었습니다.
- 규칙과 그 규칙의 예시가 서로 다른 파일에 있었습니다. 폴더로 나누면 한 주제의 규칙과 예시가 한 폴더에 있습니다.

`rfcs/README.md` 는 규칙의 뜻을 바꾸지 않는 변경에 RFC 가 필요하지 않다고 적습니다. 이 변경은 쓰는 저장소가 읽는 파일의 경로와 `style-guide init` 이 만드는 스킬의 내용을 바꾸므로 RFC 로 올립니다.

## 근거

2026-10-07 에 Node 26.10.0 으로 확인했습니다.

- 옮기기 전과 뒤의 `RULES.md` 에서 불릿 줄을 모아 정렬해 비교했습니다. 들여쓴 하위 불릿도 포함하고, 브랜치 흐름 문서는 뺍니다. 양쪽 모두 38줄이고 차이가 없습니다.
- 옮기기 전과 뒤의 `EXAMPLES.md` 를 코드 블록 밖의 `## ` 제목으로 나누어, 제목과 본문의 짝을 정렬해 비교했습니다. 양쪽 모두 21개이고 차이가 없습니다.
- `git/branch-flow/RULES.md` 와 옮기기 전의 `process/branch-flow.md` 를 `diff` 로 비교했습니다. 다른 줄은 위에 적은 한 문장뿐입니다.
- 옛 경로를 가리키는 곳은 다음 명령으로 찾았습니다. 머지된 RFC 를 빼고 모두 고쳤습니다.

  ```sh
  git grep -n -E 'process/branch-flow|rules/RULES\.md|rules/EXAMPLES\.md'
  ```

- 머지된 RFC 는 옛 경로 `rules/RULES.md`, `process/branch-flow.md` 와 옛 절 이름을 적고 있습니다. 머지된 제안 문서는 고치지 않으므로 그대로 두었습니다.
- `listPackageRuleFiles` 는 `rules/` 를 깊이와 상관없이 훑으므로 코드를 고치지 않았습니다. 패키지를 묶어 임시 저장소에 설치하고 `style-guide init` 을 실행하는 검사(`test/cli-consumer.test.ts`)에서, 만들어진 스킬의 목록이 설치된 패키지의 `rules/` 아래 파일 전부와 같고 `rules/git/branch-flow/RULES.md` 가 설치된 패키지에 있습니다.
- `npm test`, `npm run test:flow`, `npm run typecheck` 가 통과했습니다.
- `npm pack --dry-run` 의 목록에 `rules/` 아래 파일 16개가 있고 `process/` 는 없습니다.

확인하지 않은 것은 다음과 같습니다.

- 예시의 `ts` 코드를 옮긴 뒤에 다시 컴파일하지는 않았습니다. 코드 블록의 내용이 옮기기 전과 같다는 것만 위 비교로 확인했습니다.

## 쓰는 저장소에 미치는 영향

지금 통과하는 코드는 이 변경 뒤에도 통과합니다. 규칙의 뜻이 바뀐 문장이 없고, lint 설정, 포매터 설정, TypeScript 설정도 바뀌지 않기 때문입니다.

- 패키지의 버전을 올리면 `node_modules/@pleand-inc/style-guide/rules/RULES.md`, `rules/EXAMPLES.md`, `process/branch-flow.md` 가 없어집니다. 이 경로를 적은 문서나 에이전트 지시는 `node_modules/@pleand-inc/style-guide/rules/README.md` 를 가리키게 고칩니다. 쓰는 저장소에서 위의 `git grep` 을 실행하면 고칠 곳이 나옵니다.
- `style-guide init` 을 쓴 저장소는 버전을 올린 뒤 `style-guide init` 을 다시 실행합니다. 스킬 파일의 내용이 바뀌므로, 다시 실행하기 전에는 `style-guide check` 가 실패합니다.
- 옛 절 이름 "작성 가이드" 를 적은 문서는 그 항목이 옮겨 간 폴더의 이름으로 바꿉니다.
- JavaScript 파일과 설정 파일에도 적용하는 항목은 바꾸기 전과 같은 여섯 항목입니다.
