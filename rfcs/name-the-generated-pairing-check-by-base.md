# init 이 두는 짝 검사도 base 를 이름에 넣습니다

## 바꾸는 것

`style-guide init` 이 두는 `.github/workflows/style-guide-pull-request.yml` 의 짝 검사 이름을 바꿉니다.

- 지금: 모든 pull request 에서 `pull request pairing` 입니다.
- 이 RFC 뒤: `pull request pairing into <base>` 입니다. `develop` 으로 가는 pull request 에서는 `pull request pairing into develop`, `master` 로 가는 pull request 에서는 `pull request pairing into master` 입니다.

`rules/git/branch-flow/RULES.md` 의 규칙 묶음 항목에 이 이름을 적어, 규칙 묶음을 쓰는 저장소가 `master` 에 `pull request pairing into master` 를 필수 검사로 걸 수 있게 합니다. README 의 `init` 파일 표에도 두 검사의 이름을 적습니다.

## 이유

`rfcs/name-the-pairing-check-by-base.md` 가 적은 빈틈이 `init` 이 두는 워크플로에도 있습니다. 검사의 결과는 커밋에 붙고, 필수 검사는 같은 이름의 결과 가운데 가장 나중 것을 씁니다. 이름이 base 를 구분하지 않으면 같은 커밋으로 `develop` 에 연 pull request 의 통과 결과가 `master` 의 필수 검사를 채웁니다.

그 RFC 는 쓰는 저장소에 "그 검사를 필수로 걸지 않는다" 고 적었습니다. 그러면 규칙 묶음을 쓰는 저장소는 `master` 에 걸 검사가 없습니다. 지금 이 패키지를 쓰는 저장소는 규칙 묶음을 쓰지 않으므로, 바꾸는 비용이 가장 작을 때 바꿉니다.

## 근거

- style-guide 저장소에서 같은 이름을 base 별로 바꾼 뒤 확인했습니다. 작업 브랜치의 같은 커밋으로 `develop` 과 `master` 에 pull request 를 열고 `develop` 쪽 검사를 다시 통과시켜도, `master` 쪽 pull request 는 `BLOCKED` 로 남았습니다. 두 pull request 는 머지하지 않고 닫았습니다(#41, #42).
- job 이름의 `${{ github.base_ref }}` 는 검사 이름에 base 의 값으로 나타납니다. 이 저장소의 pull request 목록에서 `pull request pairing into develop`, `pull request pairing into master` 로 보였습니다(#40, #44).
- `test/cli/setup.test.mjs` 가 생성된 워크플로의 job 이름을 확인합니다.

확인하지 않은 것: 쓰는 저장소가 새 버전으로 `init` 을 다시 돌린 뒤의 검사 이름은 이 RFC 를 게시한 뒤 처음 버전을 올리는 저장소에서 확인합니다.

## 쓰는 저장소에 미치는 영향

- 새 버전으로 올린 뒤 `init` 을 다시 돌리지 않으면 `style guide setup` 검사가 `differs: .github/workflows/style-guide-pull-request.yml` 로 실패합니다. 버전을 올리는 pull request 에서 `init` 을 돌리고 결과를 커밋합니다.
- 이전 이름 `pull request pairing` 을 필수 검사로 건 저장소는 그 검사를 `pull request pairing into master` 로 바꿉니다. 바꾸지 않으면 `master` 로 가는 pull request 가 오지 않는 검사를 기다립니다.
- 검사 이름을 문서나 스크립트에 적어 둔 저장소는 그 이름을 고칩니다.
- lint, TypeScript 설정, 훅은 바뀌지 않습니다.

## 이전 제안

`rfcs/name-the-pairing-check-by-base.md` 의 "쓰는 저장소는 그 워크플로의 검사를 필수로 걸지 않습니다" 항목을 바꿉니다.
