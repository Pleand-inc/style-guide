# 규칙 문서를 주제별 폴더로 나눕니다

## 바꾸는 것

지금 `rules/` 폴더에는 파일이 둘입니다. `rules/RULES.md` 에 규칙 전부가 절 셋(핵심 원칙, 작성 가이드, 타입)으로 있고, `rules/EXAMPLES.md` 에 예시 전부가 있습니다.

이 RFC 뒤에는 `rules/` 아래에 주제마다 폴더 하나가 있습니다. 폴더 안의 `RULES.md` 가 그 주제의 규칙이고, `EXAMPLES.md` 가 그 주제의 예시입니다. 예시가 없는 주제에는 `EXAMPLES.md` 가 없습니다. `rules/README.md` 는 적용 범위와 폴더 목록을 적는 색인입니다. `rules/RULES.md` 와 `rules/EXAMPLES.md` 는 없어집니다.

| 폴더 | 주제 | 규칙 | 예시 |
|---|---|---|---|
| `principles/` | 핵심 원칙 | 중복 제거, 단일 책임, 의도 드러내기, 단순함 | 없음 |
| `naming-and-functions/` | 이름과 함수 | 의미 있는 이름, 작은 함수, 작은 단위, 삼항 연산자 | 2개 |
| `modules-and-values/` | 모듈과 값 | 가져오기 경로, 가져오기 경로의 확장자, 가져오기 순서, 스프레드 | 3개 |
| `comments-and-history/` | 주석과 변경 이력 | 주석, 이력, 티켓 만들기, 티켓 고치기, 티켓의 상태, 티켓 읽기 | 6개 |
| `types/` | 타입 | 타입 절의 항목 가운데 아래 두 폴더로 가는 셋을 뺀 아홉 | 8개 |
| `external-input/` | 외부 입력 | zod 스키마로 검증하는 항목 | 2개 |
| `type-check-performance/` | 타입 검사 성능 | 컴파일 시간을 늘리는 네 가지 타입, `tsc --extendedDiagnostics` 로 확인하는 항목 | 없음 |

규칙 문장과 예시의 내용은 바꾸지 않고 자리만 옮깁니다. 한 폴더 안에서 항목의 순서는 지금 문서에서의 순서와 같습니다. 폴더의 `RULES.md` 는 주제 이름을 제목으로 두고 규칙 문장만 담습니다. 머리말, 표, 분류 표시, 링크는 두지 않습니다.

`rules/RULES.md` 첫머리의 두 문단은 `rules/README.md` 로 옮기면서 고쳐 씁니다.

- 범위 문장은 여섯 항목의 이름을 하나씩 적는 대신 폴더 이름 하나를 적습니다. 여섯 항목이 모두 `comments-and-history/` 로 가므로 가리키는 항목은 같습니다.
  - 지금: 작성 가이드의 주석, 이력, 티켓 만들기, 티켓 고치기, 티켓의 상태, 티켓 읽기 항목은 `apps/`, `packages/`, `scripts/` 아래의 JavaScript 파일과 주석을 쓸 수 있는 설정 파일에도 적용합니다.
  - 이 RFC 뒤: `comments-and-history` 폴더의 규칙은 `apps/`, `packages/`, `scripts/` 아래의 JavaScript 파일과 주석을 쓸 수 있는 설정 파일에도 적용합니다.
- 예시 문서를 가리키던 문단과 `rules/EXAMPLES.md` 의 머리말은 `rules/README.md` 의 한 문단으로 합칩니다. 예시가 컴파일되는 코드라는 문장과 어긋난 코드도 컴파일은 된다는 문장은 그대로 둡니다.

저장소 루트의 `README.md` 와 `process/branch-flow.md` 가 적은 규칙 문서의 경로도 새 경로로 고칩니다.

## 이유

저장소 관리자가 `rules/` 가 너무 평평하다고 했고, 규칙을 `rules/` 아래의 폴더로 묶어 관리하기를 요청했습니다.

- 종류가 다른 규칙이 한 파일에 있었습니다. 작성 가이드 절에는 코드의 모양을 정하는 항목, 모듈 경로 항목, 값 복사 항목, 주석과 이력 항목, 티켓 절차가 함께 있었습니다. 타입 절에는 타입 설계 항목, 외부 입력을 검증하는 항목, 컴파일 시간을 다루는 항목이 함께 있었습니다.
- 규칙과 그 규칙의 예시가 서로 다른 파일에 있었습니다. 규칙 하나를 고치려면 두 파일에서 자리를 따로 찾아야 했습니다. 폴더로 나누면 한 주제의 규칙과 예시가 한 폴더에 있습니다.
- 범위 문장이 JavaScript 파일에도 적용하는 항목 여섯 개를 이름으로 하나씩 불러야 했습니다. 폴더로 나누면 폴더 이름 하나로 가리킵니다.

`rfcs/README.md` 는 규칙의 뜻을 바꾸지 않는 변경에 RFC 가 필요하지 않다고 적습니다. 이 변경은 쓰는 저장소가 읽는 파일의 경로를 바꾸므로 RFC 로 올립니다.

## 근거

2026-10-07 에 Node 26.10.0 으로 확인했습니다.

- 옮기기 전의 `rules/RULES.md` 와 폴더 일곱 개의 `RULES.md` 에서 불릿 줄을 모아 정렬해 비교했습니다. 들여쓴 하위 불릿도 포함합니다. 양쪽 모두 38줄이고 차이가 없습니다.
- 옮기기 전의 `rules/EXAMPLES.md` 와 폴더 다섯 개의 `EXAMPLES.md` 를 코드 블록 밖의 `## ` 제목으로 나누어, 제목과 본문의 짝을 정렬해 비교했습니다. 양쪽 모두 21개이고 차이가 없습니다.
- 두 비교는 파일을 나누는 스크립트가 나눈 직후에 실행했고, 어느 한쪽이라도 다르면 스크립트가 실패로 끝나게 했습니다. 폴더가 정해지지 않은 절이나 예시가 있어도 실패로 끝납니다.
- 옮기기 전의 두 파일을 가리키는 곳은 다음 명령으로 찾았습니다. 머지된 RFC 를 빼면 `README.md` 의 표 한 줄과 `process/branch-flow.md` 의 한 문장이었고, 둘 다 고쳤습니다.

  ```sh
  grep -rn -E 'RULES\.md|EXAMPLES\.md' --exclude-dir=node_modules --exclude-dir=.git .
  ```

- 머지된 RFC 셋(`rule-documents.md`, `no-file-extensions-in-import-paths.md`, `fail-on-unused-code-and-import-order.md`)은 옛 경로 `rules/RULES.md` 와 옛 절 이름을 적고 있습니다. 머지된 제안 문서는 고치지 않으므로 그대로 두었습니다.
- `npm run test:flow` 24건과 `npm test` 31건이 모두 통과했고, `npm run typecheck` 는 오류 없이 끝났습니다. `test/` 와 `scripts/` 의 검사는 `rules/` 를 읽지 않으므로, 이 검사들은 저장소의 다른 부분이 그대로인 것을 확인합니다.
- `npm pack --dry-run` 의 목록에 `rules/README.md` 와 폴더 일곱 개의 파일 12개가 있습니다.

확인하지 않은 것은 다음과 같습니다.

- 예시의 `ts` 코드를 옮긴 뒤에 다시 컴파일하지는 않았습니다. 코드 블록의 내용은 옮기기 전과 같다는 것만 위 비교로 확인했습니다.
- 쓰는 저장소 가운데 `Pleand-inc/salesmaker` 는 `.claude/skills/code-standards/SKILL.md` 한 곳이 옛 경로 둘을 적고 있는 것을 확인했습니다. 다른 쓰는 저장소는 보지 않았습니다.

## 쓰는 저장소에 미치는 영향

지금 통과하는 코드는 이 변경 뒤에도 통과합니다. 규칙의 뜻이 바뀐 문장이 없고, lint 설정, 포매터 설정, TypeScript 설정도 바뀌지 않기 때문입니다.

- 패키지의 버전을 올리면 `node_modules/@pleand-inc/style-guide/rules/RULES.md` 와 `rules/EXAMPLES.md` 가 없어집니다. 두 경로를 적은 문서나 에이전트 지시는 `node_modules/@pleand-inc/style-guide/rules/README.md` 를 가리키게 고칩니다. 쓰는 저장소에서 위의 `grep` 을 `node_modules` 를 빼고 실행하면 고칠 곳이 나옵니다.
- 옛 절 이름 "작성 가이드" 를 적은 문서는 그 항목이 옮겨 간 폴더의 이름으로 바꿉니다.
- JavaScript 파일과 설정 파일에도 적용하는 항목은 바꾸기 전과 같은 여섯 항목입니다.
