# 브랜치 흐름

Pleand 의 저장소가 쓰는 브랜치 흐름입니다. 이 문서는 절차를 적습니다. 코드 규칙은 `rules/typescript/` 폴더에 있습니다.

## 브랜치

| 브랜치 | 역할 | 받는 것 |
|---|---|---|
| `master` | 게시되는 브랜치 | `develop` 에서 오는 머지 커밋만 |
| `develop` | 통합 브랜치 | 작업 브랜치의 squash 커밋, 또는 pull request 의 커밋을 rebase 한 커밋만 |
| `feat\|fix\|chore\|docs/<slug>` | 작업 브랜치 | 커밋 |

작업 브랜치는 `develop` 에서 만듭니다. `master` 와 `develop` 에 직접 push 하지 않습니다.

## pull request 와 머지

- pull request 는 draft 로 올립니다(`gh pr create --draft`). 작업과 검사가 끝나 검토와 머지를 받을 준비가 되면 `gh pr ready <번호>` 로 draft 를 풉니다. 작업 브랜치에서 `develop` 으로 가는 pull request 와 `develop` 에서 `master` 로 가는 pull request 모두 같습니다. Dependabot 이 여는 pull request 는 draft 가 아닙니다.
- 작업 브랜치는 `develop` 으로 pull request 를 올리고 squash 나 rebase 로 머지합니다. rebase 머지는 pull request 의 커밋을 하나씩 새 커밋으로 만들어 `develop` 위에 올립니다. 머지되면 브랜치를 지웁니다.
- pull request 의 커밋에 머지 커밋이나 빈 커밋이 있거나, 커밋이 100개를 넘으면 rebase 로 머지하지 않고 squash 로 머지합니다. GitHub 의 rebase 머지는 처음부터 비어 있던 커밋을 버리고, `check-landed-commit` 은 rebase 머지가 `develop` 에 올린 커밋이 pull request 의 커밋 수와 같고 모두 부모가 하나일 때만 통과시킵니다. 커밋이 100개를 넘는 pull request 의 rebase 머지는 `check-landed-commit` 이 확인하지 않고 실패로 남깁니다. 스택 안의 pull request 도 rebase 로 머지하지 않고, 아래 "스택 pull request" 대로 한 층씩 squash 로 머지합니다.
- `develop` 은 `master` 로 pull request 를 올리고 머지 커밋으로 머지합니다. 머지 커밋의 제목은 pull request 의 제목 뒤에 `(#<번호>)` 를 붙인 것입니다. `develop` 은 지우지 않습니다.
- 머지는 `style-guide merge <번호>` 명령으로 합니다. style-guide 저장소에서는 `node cli/style-guide.mjs merge <번호>` 로, 패키지를 쓰는 저장소에서는 `node_modules/.bin/style-guide merge <번호>` 로 실행합니다. 명령은 pull request 의 base 와 head 를 보고 방식을 고르고, 짝이 틀리면 거부합니다. 닫혔거나 draft 인 pull request 도 거부합니다. 판단 로직은 패키지의 `cli/lib/branch-flow.mjs` 에 있고, 검사는 style-guide 저장소의 `npm run test:flow` 입니다.
- `style-guide merge` 는 `develop` 으로 가는 pull request 를 squash 로 머지합니다. `develop` 으로 가는 pull request 를 rebase 로 머지할 때만 명령 대신 GitHub 웹의 머지 버튼에서 "Rebase and merge" 를 고릅니다.
- GitHub 의 규칙 묶음을 쓸 수 있는 저장소는 같은 내용을 서버에서 강제합니다. `master` 와 `develop` 은 pull request 로만 바뀌고, 지우거나 강제 push 할 수 없습니다. `develop` 은 squash 와 rebase 를, `master` 는 머지 커밋만 허용합니다. 규칙 묶음은 pull request 의 base 만 보므로, `master` 의 규칙 묶음에는 `master` 로 가는 pull request 의 짝만 보는 검사를 필수 상태 검사로 걸어 `develop` 이 아닌 브랜치가 `master` 로 머지되지 않게 합니다. 검사의 결과는 pull request 가 아니라 커밋에 붙으므로, 이 검사의 이름은 다른 base 로 가는 pull request 의 검사와 달라야 합니다. 이름이 같으면 같은 커밋으로 `develop` 에 연 pull request 의 통과 결과가 `master` 의 필수 검사를 채웁니다. `style-guide init` 이 두는 워크플로와 style-guide 저장소의 워크플로는 이 검사를 `pull request pairing into <base>` 라는 이름으로 돌리므로, `master` 의 필수 검사는 `pull request pairing into master` 입니다.
- 규칙 묶음에는 우회 대상을 두지 않습니다. 저장소 관리자도 규칙 묶음을 우회하지 않습니다. style-guide 저장소도 이 규칙 묶음을 걸고 우회 대상을 두지 않습니다.
- `master` 에 `develop` 을 거치지 않은 커밋이 들어가면, `master` 를 `develop` 으로 머지 커밋으로 한 번 합칩니다. `develop` 에서 작업 브랜치를 만들고 그 브랜치에서 `master` 를 머지한 뒤, 그 브랜치로 `develop` 에 pull request 를 엽니다. squash 와 rebase 는 커밋을 새 커밋으로 만들어 `master` 의 커밋이 `develop` 의 조상이 되지 않으므로, 이 pull request 는 squash 나 rebase 로 머지하지 않습니다. `style-guide merge` 는 `develop` 으로 가는 pull request 를 squash 로 머지하므로, 이 pull request 는 `gh pr merge <번호> --merge` 나 GitHub 웹의 머지 버튼에서 "Create a merge commit" 을 골라 머지 커밋으로 머지합니다.
- 규칙 묶음이 `develop` 에 머지 커밋을 허용하지 않고 우회 대상도 없으므로, 이 복구 pull request 는 `develop` 을 막는 규칙 묶음을 잠시 꺼야 머지됩니다. 규칙 묶음을 바꿀 권한이 있는 사람이 그 규칙 묶음의 enforcement 를 `disabled` 로 바꿉니다. 그동안 위의 방법으로 pull request 를 머지 커밋으로 머지하거나 그 pull request 의 head 커밋으로 `develop` 을 옮기고, 끝나면 곧바로 enforcement 를 `active` 로 되돌립니다. `init` 이 둔 pre-push 훅은 `develop` 으로 가는 push 를 막으므로, head 커밋으로 옮길 때는 `gh api -X PATCH repos/<소유자>/<저장소>/git/refs/heads/develop -f sha=<head 커밋>` 으로 옮깁니다. 이 요청은 `force` 를 주지 않으면 fast-forward 만 받아들입니다.
- 조직의 규칙 묶음은 대상인 모든 저장소에 걸립니다. 그래서 그 규칙 묶음을 끄는 동안에는 그 규칙 묶음이 걸린 모든 저장소의 `develop` 이 풀리고, 그 규칙 묶음이 `master` 도 막으면 `master` 도 풀립니다. 다른 저장소를 풀지 않으려면 규칙 묶음을 끄는 대신, 규칙 묶음의 저장소 조건에서 복구할 저장소 하나만 잠시 빼고, 머지한 뒤 곧바로 되돌립니다. 저장소를 이름(`repository_name`)이나 속성(`repository_property`)으로 고르는 규칙 묶음에서는 그 저장소를 제외(`exclude`)에 넣었다가 지웁니다. 제외는 이 두 조건에만 있습니다. 저장소 ID 목록(`repository_id` 의 `repository_ids`)으로 고르는 규칙 묶음에는 제외가 없으므로, 그 목록에서 그 저장소의 ID 를 지웠다가 다시 넣습니다. 어느 쪽이든 뺀 동안 그 저장소에서는 그 규칙 묶음이 막는 브랜치가 모두 풀리므로, 그 규칙 묶음이 `master` 도 막으면 그 저장소의 `master` 도 풀립니다.
- 복구 머지가 `develop` 에 올린 커밋은 부모가 둘이므로 `check-landed-commit` 이 그 push 를 실패로 남깁니다. 이 실패는 예상한 것이므로 받아들이고, 그 커밋은 되돌리지 않습니다.
- 규칙 묶음을 쓸 수 없는 저장소에서는 서버가 흐름을 벗어난 머지와 push 를 막지 않습니다. 그 저장소에서는 아래 "저장소에 적용하기" 의 검사가 벗어난 pull request 와 커밋을 실패로 남깁니다.

## 릴리스

`develop` 을 `master` 로 올리는 pull request 를 머지한 뒤, `v` 뒤에 `package.json` 의 `version` 을 붙인 태그를 push 합니다. 게시 워크플로는 저장소 루트의 `README.md` 에 있습니다.

## 스택 pull request

한 작업이 서로 의존하는 변경 여럿으로 나뉘면 GitHub 의 스택 pull request 를 씁니다. 맨 아래 pull request 는 `develop` 을 base 로 두고, 위의 pull request 는 바로 아래 pull request 의 브랜치를 base 로 둡니다. 검토자는 층마다 그 층의 변경만 봅니다.

- 스택의 층마다 작업 브랜치를 하나 둡니다. 맨 아래 층의 브랜치는 `develop` 에서 만들고, 위 층의 브랜치는 바로 아래 층의 브랜치에서 만듭니다. 층마다 브랜치를 `git push` 로 올리고 `gh pr create --draft` 로 pull request 를 엽니다. 위 층의 pull request 는 `--base <아래 층의 브랜치>` 를 붙여 엽니다. 그다음 `gh stack` 확장의 `gh stack link --base develop <맨 아래부터 맨 위까지의 번호>` 로 pull request 들을 스택으로 묶습니다. 이 명령은 API 로 스택을 만들고, base 가 이 순서와 다른 pull request 의 base 를 고칩니다. 이미 열려 있는 pull request 도 같은 명령으로 묶습니다. 번호로 준 pull request 는 로컬 브랜치가 없어도 묶입니다. 스택에 층을 더할 때는 맨 위에 더하고, `gh stack link <스택 번호> <더한 pull request 의 번호>` 로 붙입니다. 스택 번호는 GitHub 의 스택 화면에 보이는 번호입니다. 층마다 준비가 끝나면 `gh pr ready <번호>` 로 draft 를 풉니다.
- 한 층에는 아래 층에 기대는 변경만 둡니다. 다른 관심사가 시작되면 새 층을 만듭니다.
- 머지는 맨 아래부터 한 층씩 합니다. 스택 안의 pull request 는 `gh pr merge` 로 머지되지 않고 스택용 머지로만 됩니다. `style-guide merge <맨 아래 pull request 의 번호>` 가 스택을 알아보고 `gh stack merge <번호> --squash --yes` 를 부릅니다. 아래 pull request 를 머지하면 위의 pull request 가 자동으로 `develop` 을 base 로 바꾸고 서버에서 rebase 됩니다. 머지된 아래 브랜치는 자동으로 지워지지 않으므로, 머지 명령이 pull request 가 머지된 것을 확인한 뒤 지웁니다. `gh stack` 에는 `--repo` 옵션이 없어서 스택 안의 pull request 는 그 저장소의 체크아웃 안에서만 머지됩니다. GitHub 웹의 머지 상자에 있는 "Merge stack" 버튼은 쓰지 않습니다. 이 버튼은 스택의 모든 층을 push 한 번으로 `develop` 에 올립니다. `check-landed-commit` 은 GitHub 의 pull request 응답에 `stack` 이 있는 pull request 를 rebase 머지로 받지 않으므로, 머지된 맨 위 pull request 의 응답에도 `stack` 이 있으면 그 push 는 실패로 남습니다. 그 응답에 `stack` 이 없으면 rebase 로 올린 그 push 는 통과할 수 있고, squash 로 올린 push 도 층마다 squash 커밋의 메시지와 작성자를 맨 위 pull request 의 커밋과 차례대로 같게 했으면 통과할 수 있습니다. 이 버튼으로 머지하면 머지 명령이 하는 브랜치 삭제도 거치지 않습니다.
- 스택 안의 모든 pull request 에 `develop` 의 규칙 묶음이 적용됩니다.
- 아래 층을 고치면 위 층의 브랜치에서 아래 층의 브랜치를 `git merge` 로 받고, 강제 옵션 없이 `git push` 로 올립니다. 층의 이력을 선형으로 만드는 rebase 는 서버가 합니다. 아래 pull request 가 머지되면 GitHub 가 위 층을 rebase 하고, GitHub 웹의 머지 상자에서 "Rebase stack" 을 누르면 그때 rebase 합니다. 서버가 rebase 한 브랜치는 `git fetch` 뒤 로컬 브랜치를 원격 브랜치에 맞춥니다. 맞추기 전의 로컬 브랜치에서는 push 하지 않습니다. 로컬 브랜치에 push 하지 않은 커밋이 있으면 맞춘 뒤 그 커밋을 다시 적용합니다. push 한 브랜치는 강제 push 하지 않습니다. 그래서 `gh stack submit`, `gh stack push`, `gh stack sync`, `gh stack rebase` 는 쓰지 않습니다.

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
- pull request 워크플로는 `check-pull-request` 와 `check` 를 `pull request pairing into <base>` 검사 하나에서 이 순서로 돌립니다. `check-pull-request` 가 실패하면 `check` 는 돌지 않습니다. 이 검사를 필수로 건 저장소에서는 `check` 의 실패도 머지를 막습니다.
- pull request 워크플로는 pull request 를 열거나, 다시 열거나, head 에 push 할 때 돕니다. 제목이나 본문을 고친 것만으로는 돌지 않습니다. base 를 바꾼 뒤 새 base 의 검사가 돌지 않았으면 head 에 다음 커밋을 push 하거나 pull request 를 닫았다 다시 엽니다.
- `check-landed-commit` 은 브랜치가 이미 움직인 뒤에 돕니다. push 를 막지는 못하고, 흐름을 벗어난 커밋의 검사를 실패로 남깁니다. `develop` 의 커밋은 부모가 하나씩이어야 하고, `master` 의 커밋은 부모가 둘이고 head 가 `develop` 인 pull request 의 `merge_commit_sha` 여야 합니다. 강제 push 와 브랜치 생성도 실패합니다.
- push 하나는 브랜치를 첫 부모를 따라 커밋 하나만큼 옮겨야 합니다. 예외는 `develop` 에 rebase 로 머지된 pull request 하나뿐입니다. 그 push 는 여섯 가지를 모두 채울 때 통과합니다. 맨 위 커밋이 흐름에 맞는 짝으로 `develop` 에 머지된 pull request 의 `merge_commit_sha` 입니다. 맨 위 커밋은 그 pull request 의 head 커밋(`head.sha`)이 아닙니다. 그 pull request 의 커밋은 100개 이하입니다. 그 pull request 의 응답(`GET /repos/{owner}/{repo}/pulls/{number}`)에 스택을 적은 `stack` 객체가 없습니다. 맨 위 커밋에서 첫 부모를 따라 그 pull request 의 커밋 수만큼 내려가면 push 전의 `develop` 에 닿고, 그 사이의 커밋은 모두 부모가 하나입니다. push 전의 `develop` 바로 위부터 맨 위 커밋까지의 커밋이 그 pull request 의 커밋과 차례대로 메시지와 작성자의 이름, 이메일이 같습니다. 그 밖에 `develop` 이나 `master` 를 커밋 여럿만큼 옮긴 push 는 실패합니다. 스택의 층 여럿을 push 한 번으로 올린 push 는 머지된 맨 위 pull request 의 응답에 `stack` 이 남아 있으면 실패하고, 남지 않으면 통과할 수 있습니다(위 "스택 pull request"). rebase 머지인지 확인하는 GitHub 요청이 실패했거나 pull request 의 커밋이 100개를 넘어 확인하지 않았으면, 실패 메시지의 커밋 목록 아래에 그 이유를 적은 줄이 하나 더 붙습니다.
- 태그는 `check-push` 를 통과합니다.
- 작업 브랜치의 접두사와 오래 두는 브랜치는 저장소 루트의 `style-guide.config.json` 에서 바꿉니다. 오래 두는 브랜치에는 push 할 수 있습니다. 이 브랜치는 `develop` 이나 `master` 로 가는 pull request 의 head 가 될 수 없습니다.
- `init` 이 만드는 파일, 손으로 해야 하는 일, 설정 파일의 형식은 패키지의 `README.md` 에 있습니다.
