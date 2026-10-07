# 규칙

규칙은 무엇에 대한 규칙인지에 따라 폴더 둘로 나뉩니다. `typescript/` 는 TypeScript 코드 규칙이고, `git/` 은 브랜치 흐름과 변경 이력의 규칙입니다. 두 폴더 안에서는 주제마다 폴더 하나가 있습니다.

폴더의 `RULES.md` 가 규칙입니다. `EXAMPLES.md` 는 규칙에 어긋난 코드와 규칙에 맞는 코드의 짝이고, 규칙을 코드로 옮기는 방법이 확실하지 않을 때 읽습니다. `EXAMPLES.md` 의 코드는 모두 TypeScript 로 컴파일되는 코드입니다. 어긋난 코드는 컴파일은 되지만 규칙을 어깁니다.

## TypeScript 코드 규칙

이 저장소의 모든 TypeScript 코드는 `typescript/` 폴더의 규칙을 따릅니다. 테스트 코드에도 똑같이 적용합니다. `typescript/comments/` 의 규칙은 `apps/`, `packages/`, `scripts/` 아래의 JavaScript 파일과 주석을 쓸 수 있는 설정 파일에도 적용합니다.

- `typescript/principles/`: 핵심 원칙
- `typescript/naming-and-functions/`: 이름과 함수
- `typescript/modules-and-values/`: 모듈과 값
- `typescript/comments/`: 주석
- `typescript/types/`: 타입
- `typescript/external-input/`: 외부 입력
- `typescript/type-check-performance/`: 타입 검사 성능

## git 규칙

- `git/branch-flow/`: 브랜치 흐름. 브랜치를 만들거나 pull request 를 올리거나 머지하기 전에 읽습니다.
- `git/decision-tickets/`: 변경 이력과 티켓. TypeScript 코드와, `apps/`, `packages/`, `scripts/` 아래의 JavaScript 파일과 주석을 쓸 수 있는 설정 파일에 적용합니다.
