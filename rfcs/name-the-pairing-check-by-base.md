# master 의 필수 짝 검사는 base 를 이름에 넣은 검사로 겁니다

## 바꾸는 것

`rules/git/branch-flow/RULES.md` 의 규칙 묶음 항목을 고쳐 씁니다.

- 지금: `master` 의 규칙 묶음에 `pull request pairing` 검사를 필수 상태 검사로 겁니다.
- 이 RFC 뒤: `master` 의 규칙 묶음에 `master` 로 가는 pull request 의 짝만 보는 검사를 필수로 겁니다. 그 검사의 이름은 다른 base 로 가는 pull request 의 검사와 달라야 합니다. style-guide 저장소의 검사 이름은 `pull request pairing into master` 입니다.

저장소의 워크플로와 설정도 바꿉니다. 이 둘은 패키지에 실리지 않습니다.

- `.github/workflows/branch-flow.yml` 의 job 이름을 `pull request pairing into ${{ github.base_ref }}` 로 바꿉니다.
- `master` 의 규칙 묶음이 요구하는 검사를 `pull request pairing` 에서 `pull request pairing into master` 로 바꿉니다.

## 이유

필수 상태 검사는 pull request 가 아니라 head 커밋에 붙은 검사 결과를 봅니다. 같은 커밋에 같은 이름의 검사가 여럿 있으면 가장 나중의 결과를 씁니다.

`pull request pairing` 이라는 이름 하나를 모든 base 에 쓰면, 같은 커밋을 head 로 둔 다른 pull request 의 통과 결과가 `master` 의 필수 검사를 채웁니다. 작업 브랜치에서 `develop` 으로 연 pull request 는 짝 검사를 통과합니다. 그 검사가 다시 돌면 같은 브랜치로 `master` 에 연 pull request 도 머지할 수 있게 됩니다.

## 근거

2026-10-07 에 이 저장소에서 확인했습니다.

- 같은 커밋을 head 로 두고 두 pull request 를 열었습니다. 하나는 작업 브랜치에서 `master` 로, 다른 하나는 `develop` 에서 `master` 로 갔습니다.
- 작업 브랜치 쪽의 자기 실행은 `failure` 였습니다. 같은 커밋에 `develop` 쪽의 `success` 가 나중에 붙자 작업 브랜치 쪽 pull request 의 상태가 `CLEAN` 이 되었습니다. 근거는 `GET /repos/{repo}/commits/{sha}/check-runs` 의 같은 이름 실행 둘과 pull request 의 `mergeStateStatus` 입니다. 두 pull request 는 머지하지 않고 닫았습니다.
- 이 경우는 작업 브랜치가 `develop` 과 같은 커밋이라 내용은 같았습니다. 내용이 다른 경우는 위 이유 절의 순서로 일어납니다. 이 RFC 를 머지한 뒤 그 순서로 확인합니다.

확인하지 않은 것: job 이름에 표현식을 넣었을 때 GitHub 가 필수 검사의 이름을 그 값으로 맞추는지는 이 RFC 를 머지한 뒤 첫 pull request 에서 확인합니다.

## 쓰는 저장소에 미치는 영향

규칙의 뜻과 lint, TypeScript 설정은 바뀌지 않습니다.

- `style-guide init` 이 두는 pull request 워크플로의 검사 이름은 base 를 구분하지 않는 `pull request pairing` 입니다. 이 검사를 `master` 의 필수 검사로 걸면 위의 빈틈이 생깁니다. 규칙 묶음을 쓰는 저장소는 그 워크플로의 검사를 필수로 걸지 않습니다.

## 이전 제안

`rfcs/required-pairing-check-and-admin-bypass.md` 의 필수 검사 이름과 "쓰는 저장소는 `init` 의 검사를 필수로 걸 수 있습니다" 항목을 바꿉니다.
