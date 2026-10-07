# 브랜치 흐름

Pleand 의 저장소가 쓰는 브랜치 흐름입니다. 이 문서는 절차를 적습니다. 코드 규칙은 `rules/typescript/` 폴더에 있습니다.

## 브랜치

| 브랜치 | 역할 | 받는 것 |
|---|---|---|
| `master` | 게시되는 브랜치 | `develop` 에서 오는 머지 커밋만 |
| `develop` | 통합 브랜치 | 작업 브랜치의 squash 커밋만 |
| `feat\|fix\|chore\|docs/<slug>` | 작업 브랜치 | 커밋 |

작업 브랜치는 `develop` 에서 만듭니다. `master` 와 `develop` 에 직접 push 하지 않습니다.

## pull request 와 머지

- pull request 는 draft 로 올립니다(`gh pr create --draft`). 작업과 검사가 끝나 검토와 머지를 받을 준비가 되면 `gh pr ready <번호>` 로 draft 를 풉니다. 작업 브랜치에서 `develop` 으로 가는 pull request 와 `develop` 에서 `master` 로 가는 pull request 모두 같습니다. Dependabot 이 여는 pull request 는 draft 가 아닙니다.
- 작업 브랜치는 `develop` 으로 pull request 를 올리고 squash 로 머지합니다. 머지되면 브랜치를 지웁니다.
- `develop` 은 `master` 로 pull request 를 올리고 머지 커밋으로 머지합니다. 머지 커밋의 제목은 pull request 의 제목 뒤에 `(#<번호>)` 를 붙인 것입니다. `develop` 은 지우지 않습니다.
- 머지는 `style-guide merge <번호>` 명령으로 합니다. style-guide 저장소에서는 `node cli/style-guide.mjs merge <번호>` 로, 패키지를 쓰는 저장소에서는 `node_modules/.bin/style-guide merge <번호>` 로 실행합니다. 명령은 pull request 의 base 와 head 를 보고 방식을 고르고, 짝이 틀리면 거부합니다. 닫혔거나 draft 인 pull request 도 거부합니다. 판단 로직은 패키지의 `cli/lib/branch-flow.mjs` 에 있고, 검사는 style-guide 저장소의 `npm run test:flow` 입니다.
- GitHub 의 규칙 묶음을 쓸 수 있는 저장소는 같은 내용을 서버에서 강제합니다. `master` 와 `develop` 은 pull request 로만 바뀌고, `develop` 은 squash 만, `master` 는 머지 커밋만 허용합니다. 규칙 묶음은 pull request 의 base 만 보므로, `master` 의 규칙 묶음에는 `master` 로 가는 pull request 의 짝만 보는 검사를 필수 상태 검사로 걸어 `develop` 이 아닌 브랜치가 `master` 로 머지되지 않게 합니다. 검사의 결과는 pull request 가 아니라 커밋에 붙으므로, 이 검사의 이름은 다른 base 로 가는 pull request 의 검사와 달라야 합니다. 이름이 같으면 같은 커밋으로 `develop` 에 연 pull request 의 통과 결과가 `master` 의 필수 검사를 채웁니다. `style-guide init` 이 두는 워크플로와 style-guide 저장소의 워크플로는 이 검사를 `pull request pairing into <base>` 라는 이름으로 돌리므로, `master` 의 필수 검사는 `pull request pairing into master` 입니다.
- style-guide 저장소는 이 규칙 묶음을 걸어 두었습니다. 우회는 `develop` 의 규칙 묶음에서 저장소 관리자에게만, pull request 에 한해 허용합니다. 이 우회는 아래 복구 머지에만 씁니다.
- `master` 에 `develop` 을 거치지 않은 커밋이 들어가면, `master` 를 `develop` 으로 머지 커밋으로 한 번 합칩니다. `develop` 에서 작업 브랜치를 만들고 그 브랜치에서 `master` 를 머지한 뒤, 그 브랜치로 `develop` 에 pull request 를 엽니다. squash 로 머지하면 `master` 의 커밋이 `develop` 의 조상이 되지 않으므로 squash 로 머지하지 않습니다. 규칙 묶음이 `develop` 에 squash 만 허용하는 저장소에서는 저장소 관리자가 그 pull request 의 head 커밋을 `develop` 으로 push 합니다. 관리자의 우회는 열린 pull request 의 head 로 옮기는 push 를 통과시키고, 다른 push 와 squash 가 아닌 머지는 통과시키지 않습니다.
- 규칙 묶음을 쓸 수 없는 저장소에서는 서버가 흐름을 벗어난 머지와 push 를 막지 않습니다. 그 저장소에서는 아래 "저장소에 적용하기" 의 검사가 벗어난 pull request 와 커밋을 실패로 남깁니다.

## 릴리스

`develop` 을 `master` 로 올리는 pull request 를 머지한 뒤, `v` 뒤에 `package.json` 의 `version` 을 붙인 태그를 push 합니다. 게시 워크플로는 저장소 루트의 `README.md` 에 있습니다.

## 스택 pull request

한 작업이 서로 의존하는 변경 여럿으로 나뉘면 GitHub 의 스택 pull request 를 씁니다. 맨 아래 pull request 는 `develop` 을 base 로 두고, 위의 pull request 는 바로 아래 pull request 의 브랜치를 base 로 둡니다. 검토자는 층마다 그 층의 변경만 봅니다.

- 스택은 `gh stack` 확장으로 만듭니다. `gh stack init --base develop <첫 브랜치>` 로 시작하고, 다음 층은 `gh stack add <브랜치>` 로 더하고, `gh stack submit --auto` 로 push 와 pull request 생성을 한 번에 합니다. `--auto` 는 pull request 를 draft 로 만들고, 층마다 준비가 끝나면 `gh pr ready <번호>` 로 풉니다.
- 한 층에는 아래 층에 기대는 변경만 둡니다. 다른 관심사가 시작되면 새 층을 만듭니다.
- 머지는 맨 아래부터 합니다. 스택 안의 pull request 는 `gh pr merge` 로 머지되지 않고 스택용 머지로만 됩니다. `style-guide merge <번호>` 가 스택을 알아보고 `gh stack merge <번호> --squash --yes` 를 부릅니다. 아래 pull request 를 머지하면 위의 pull request 가 자동으로 `develop` 을 base 로 바꾸고 서버에서 rebase 됩니다. 머지된 아래 브랜치는 자동으로 지워지지 않으므로, 머지 명령이 pull request 가 머지된 것을 확인한 뒤 지웁니다. `gh stack` 에는 `--repo` 옵션이 없어서 스택 안의 pull request 는 그 저장소의 체크아웃 안에서만 머지됩니다.
- 스택 안의 모든 pull request 에 `develop` 의 규칙 묶음이 적용됩니다.
- 아래 층을 고치면 `gh stack rebase` 로 위 층을 따라 올리고 `gh stack push` 로 올립니다. 아래 층이 머지된 뒤에는 `gh stack sync` 로 서버의 rebase 를 받아 옵니다.

## 저장소에 적용하기

패키지를 설치한 저장소는 루트에서 `npx style-guide init` 을 실행합니다. `init` 은 이 흐름을 지키는 훅과 워크플로를 저장소에 둡니다.

| 파일 | 실행하는 명령 | 실패하는 경우 |
|---|---|---|
| `.husky/pre-commit` | `style-guide check-commit` | `master` 나 `develop` 에서 커밋할 때 |
| `.husky/pre-push` | `style-guide check-push` | `master` 나 `develop` 을 push 하거나 지울 때, 작업 브랜치도 오래 두는 브랜치도 아닌 브랜치를 push 할 때 |
| `.github/workflows/style-guide-pull-request.yml` | `style-guide check-pull-request` | pull request 의 base 와 head 가 흐름에 없는 짝일 때 |
| `.github/workflows/style-guide-pull-request.yml` | `style-guide check` | `init` 이 둔 파일이 없거나 바뀌었을 때 |
| `.github/workflows/style-guide-push.yml` | `style-guide check-landed-commit` | `master` 나 `develop` 에 올라온 커밋이 흐름에 맞게 머지된 pull request 하나가 아닐 때 |

- `check-pull-request` 는 세 가지 짝을 통과시킵니다. 작업 브랜치에서 `develop` 으로, `develop` 에서 `master` 로, 스택의 한 층인 작업 브랜치에서 작업 브랜치로 가는 pull request 입니다.
- `check-landed-commit` 은 브랜치가 이미 움직인 뒤에 돕니다. push 를 막지는 못하고, 흐름을 벗어난 커밋의 검사를 실패로 남깁니다. `develop` 의 커밋은 부모가 하나여야 하고, `master` 의 커밋은 부모가 둘이고 head 가 `develop` 인 pull request 의 머지 커밋이어야 합니다. 강제 push 와 브랜치 생성도 실패합니다.
- 태그는 `check-push` 를 통과합니다.
- 작업 브랜치의 접두사와 오래 두는 브랜치는 저장소 루트의 `style-guide.config.json` 에서 바꿉니다. 오래 두는 브랜치에는 push 할 수 있습니다. 이 브랜치는 `develop` 이나 `master` 로 가는 pull request 의 head 가 될 수 없습니다.
- `init` 이 만드는 파일, 손으로 해야 하는 일, 설정 파일의 형식은 패키지의 `README.md` 에 있습니다.
