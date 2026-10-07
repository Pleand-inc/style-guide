# master 로 가는 pull request 에 짝 검사를 필수로 걸고, develop 의 복구 머지에 관리자 우회를 둡니다

## 바꾸는 것

규칙 문서 `rules/git/branch-flow/RULES.md` 의 규칙 묶음 항목을 고쳐 쓰고, 복구 머지 항목을 더합니다.

- 지금: 규칙 묶음은 `master` 와 `develop` 을 pull request 로만 바꾸게 하고, `develop` 은 squash 만, `master` 는 머지 커밋만 허용합니다. style-guide 저장소는 우회 대상 없이 걸어 두었다고 적습니다.
- 이 RFC 뒤: 같은 내용에 더해, `master` 의 규칙 묶음에 `pull request pairing` 검사를 필수 상태 검사로 겁니다. style-guide 저장소는 `develop` 의 규칙 묶음에서 저장소 관리자에게만 pull request 에 한해 우회를 허용합니다. `master` 에 `develop` 을 거치지 않은 커밋이 들어간 뒤의 복구 머지 절차를 적습니다.

저장소 설정과 워크플로도 함께 바꿉니다. 이 둘은 패키지에 실리지 않습니다.

- `.github/workflows/branch-flow.yml` 을 더합니다. pull request 마다 `node cli/style-guide.mjs check-pull-request` 를 `pull request pairing` 이라는 이름으로 돌립니다.
- `master` 의 규칙 묶음에 `pull request pairing` 을 필수 상태 검사로 더합니다. 이 워크플로가 `develop` 에 들어간 뒤에 겁니다. 먼저 걸면 `develop` 에서 `master` 로 가는 pull request 가 검사를 기다리며 머지되지 않습니다.
- `develop` 의 규칙 묶음에 우회 대상으로 저장소 관리자 역할을 pull request 모드로 더합니다.

## 이유

규칙 묶음의 pull request 규칙은 base 만 봅니다. 그래서 작업 브랜치에서 `master` 로 가는 pull request 도 머지 커밋으로 머지됩니다. 문서가 적은 "`master` 는 `develop` 에서 오는 머지 커밋만" 을 서버가 지키지 못합니다.

`develop` 이 아닌 커밋이 `master` 에 들어가면 다음 `develop` → `master` pull request 가 충돌로 머지되지 않습니다. 이것을 푸는 방법은 `master` 를 `develop` 으로 머지 커밋으로 합치는 것인데, `develop` 의 규칙 묶음은 squash 만 허용하고 우회 대상이 없어서 규칙 묶음을 잠시 꺼야만 했습니다.

저장소 관리자가 둘 다 고치기로 결정했습니다. 필수 검사와 관리자 우회입니다.

## 근거

규칙 묶음을 걸 수 있는 공개 시험 저장소에서, 이 저장소와 같은 규칙 묶음으로 확인했습니다. 2026-10-07 에 GitHub REST API 로 시도했습니다.

필수 검사:

- 작업 브랜치에서 `master` 로 가는 pull request 를 머지 커밋으로 머지하자, 지금의 규칙 묶음은 받아들였습니다.
- `master` 의 규칙 묶음에 `pull request pairing` 을 필수 상태 검사로 더하자 같은 시도가 `405 Required status check "pull request pairing" is failing` 으로 거부됐습니다.
- `develop` 에서 `master` 로 가는 pull request 는 검사가 통과해 머지 커밋으로 머지됐습니다.

`develop` 의 우회(저장소 관리자, pull request 모드):

- 규칙 묶음 API 는 이 사용자의 우회를 `current_user_can_bypass: pull_requests_only` 로 보고합니다.
- pull request 와 관계없는 커밋으로 `develop` 을 옮기는 시도는 `422 Changes must be made through a pull request` 로 거부됐습니다.
- 열린 pull request 의 head 커밋으로 `develop` 을 옮기는 시도는 받아들여졌습니다. 두 번 시도해 두 번 같았습니다.
- pull request 를 API 로 머지 커밋 방식으로 머지하는 시도는 `405 Merge commits are not allowed on this repository` 로 거부됐습니다. 우회가 허용 머지 방식은 넘지 않습니다.
- 그래서 복구 머지는 머지 커밋을 작업 브랜치에서 만들고, 그 head 를 `develop` 으로 push 하는 방식으로 적었습니다.

확인하지 않은 것은 다음과 같습니다.

- GitHub 웹의 머지 화면에서 우회 선택지를 써서 머지 커밋으로 머지하는 경로는 시험하지 않았습니다.
- 이 저장소에 규칙 묶음을 바꾼 뒤의 동작은 이 RFC 를 머지한 뒤 같은 시도로 확인합니다.

## 쓰는 저장소에 미치는 영향

규칙의 뜻과 lint, TypeScript 설정은 바뀌지 않습니다. 지금 통과하는 코드는 계속 통과합니다.

- 규칙 묶음을 쓰는 저장소는 `master` 의 규칙 묶음에 `pull request pairing` 을 필수 상태 검사로 걸 수 있습니다. `style-guide init` 이 두는 pull request 워크플로가 같은 이름의 검사를 만듭니다.
- 규칙 묶음을 쓸 수 없는 저장소는 바뀌는 것이 없습니다. 복구 머지 항목은 그 저장소에도 적용되며, 그 저장소에서는 서버가 머지 커밋을 막지 않습니다.
- 복구 머지 뒤의 `develop` 커밋은 부모가 둘이므로 `style-guide check-landed-commit` 이 실패로 표시합니다.
