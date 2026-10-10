# init 이 두는 pull request 워크플로를 job 하나로 돌리고, edited 에서는 돌리지 않습니다

## 바꾸는 것

`style-guide init` 이 두는 `.github/workflows/style-guide-pull-request.yml` 을 바꿉니다.

job 입니다.

- 지금: job 둘이 따로 돕니다. `pull request pairing into <base>` job 이 `style-guide check-pull-request` 를 돌리고, `style guide setup` job 이 `style-guide check` 를 돌립니다.
- 이 RFC 뒤: `pull request pairing into <base>` job 하나가 `style-guide check-pull-request` 를 돌리고, 이어서 `style-guide check` 를 돌립니다. `check-pull-request` 단계가 실패하면 `check` 단계는 돌지 않습니다. 검사 이름 `style guide setup` 은 없어집니다.
- 환경 변수는 단계마다 둡니다. `BASE_REF` 와 `HEAD_REF` 는 지금처럼 `check-pull-request` 단계에만 주고, `NPM_CONFIG_LEGACY_PEER_DEPS` 는 두 단계에 줍니다.

트리거입니다.

- 지금: `pull_request` 의 `opened`, `reopened`, `synchronize`, `edited` 에서 돕니다.
- 이 RFC 뒤: `opened`, `reopened`, `synchronize` 에서 돕니다. pull request 의 제목, 본문, base 를 고친 것만으로는 돌지 않습니다.

`rules/git/branch-flow/RULES.md` 의 "저장소에 적용하기" 절에서 `check-pull-request` 항목 뒤에 두 항목을 더합니다.

- "pull request 워크플로는 `check-pull-request` 와 `check` 를 `pull request pairing into <base>` 검사 하나에서 이 순서로 돌립니다. `check-pull-request` 가 실패하면 `check` 는 돌지 않습니다. 이 검사를 필수로 건 저장소에서는 `check` 의 실패도 머지를 막습니다."
- "pull request 워크플로는 pull request 를 열거나, 다시 열거나, head 에 push 할 때 돕니다. 제목, 본문, base 를 고친 것만으로는 돌지 않습니다. base 를 바꾼 뒤에는 head 에 다음 커밋을 push 하거나 pull request 를 닫았다 다시 열 때 새 base 의 검사가 돕니다."

README 의 `init` 파일 표에서 pull request 워크플로의 설명을 바꾸고, 표 아래에 워크플로가 도는 때를 적은 문단을 더합니다.

`init` 이 두는 push 워크플로와 스킬 파일은 바뀌지 않습니다. style-guide 저장소 자신의 `.github/workflows/branch-flow.yml` 도 바꾸지 않습니다.

## 이유

이 패키지를 쓰는 비공개 저장소 하나의 GitHub Actions 사용 분이 빠르게 늘었습니다. 비공개 저장소는 job 마다 쓴 시간을 분 단위로 올려 청구합니다. 이 워크플로는 평균 9.2초인 job 둘을 pull request 이벤트마다 돌려, 그 저장소 사용 분의 47% 를 차지했습니다. 수치는 아래 근거 절에 있습니다.

job 을 하나로 합치면 이벤트 하나가 청구하는 분이 2분에서 1분이 됩니다. 두 명령은 같은 checkout 과 Node 설치를 씁니다.

`edited` 는 제목이나 본문을 고칠 때도 옵니다. `check-pull-request` 는 base 와 head 의 이름과 `style-guide.config.json` 만 읽습니다(`cli/commands/check-pull-request.mjs:8-9`, `:18`). `check` 는 저장소의 파일과 설치된 패키지의 규칙 파일 목록만 읽습니다(`cli/commands/check.mjs:14-17`). 그래서 제목과 본문을 고친 실행은 결과를 바꾸지 않습니다. 그 저장소에서 같은 커밋에 다시 돈 25회 가운데 22회가 이런 실행이었습니다.

`edited` 를 남기고 base 가 바뀐 경우에만 job 을 돌리는 방법은 쓰지 않습니다. job 의 `if` 로 거르면 제목이나 본문을 고친 이벤트마다 건너뛴 job 이 남고, GitHub 는 건너뛴 job 의 상태를 성공으로 보고합니다. 필수 검사는 같은 커밋에 붙은 같은 이름의 결과 가운데 가장 나중 것을 씁니다. 그래서 건너뛴 실행이 같은 커밋의 앞선 실패를 덮습니다. 예를 들어 `develop` 이 아닌 브랜치에서 `master` 로 연 pull request 는 `pull request pairing into master` 가 실패합니다. 그 뒤에 본문을 고치면 건너뛴 `pull request pairing into master` 가 성공으로 붙어 `master` 의 필수 검사를 채웁니다. 단계의 `if` 로 거르거나 base 가 바뀌지 않았을 때 바로 성공으로 끝내도 같습니다. 이벤트마다 검사를 다시 돌리거나, 아예 돌리지 않는 것만 앞선 실패를 남깁니다.

`edited` 를 빼면 base 를 바꾼 뒤 다음 push 나 다시 열기까지 새 base 의 짝 검사가 돌지 않습니다. 규칙 묶음이 그 이름을 필수 검사로 거는 저장소에서는 검사가 비어 머지가 막힙니다. 검사가 없는 쪽은 통과가 아니라 막힘이므로, 흐름을 벗어난 머지가 통과하지는 않습니다. 규칙 묶음을 쓰지 않는 저장소에서는 `style-guide merge` 가 머지할 때 짝을 스스로 판정해 흐름 밖의 짝을 거절하고, 머지 뒤에는 `landed commit` 검사가 봅니다. 코드의 자리는 근거 절에 있습니다.

## 누가 정했나

운영자가 고른 것과, 조율 세션의 판단과, 이 제안 문서를 쓴 쪽의 판단을 나눠 적습니다. 운영자는 사용 분이 늘어난 저장소를 운영하는 사람입니다. 조율 세션은 운영자와 대화하며 이 변경을 이 제안 문서를 쓴 쪽에게 맡긴 에이전트 세션입니다. 운영자의 승인은 조율 세션이 전했습니다. 운영자가 고른 것은 안이고, 문장은 모두 이 제안 문서를 쓴 쪽이 적었습니다.

운영자가 고른 것입니다.

- 두 job 을 하나로 합칩니다.
- `edited` 에서는 돌지 않게 합니다.

조율 세션의 판단입니다.

- 합친 job 의 이름을 지금의 `pull request pairing into ${{ github.base_ref }}` 그대로 둡니다.
- 이벤트 종류를 `[opened, reopened, synchronize]` 로 합니다.
- 같은 pull request 에 이 RFC 를 넣습니다. 검사 이름을 바꾼 변경에 RFC 를 쓴 전례(`rfcs/name-the-generated-pairing-check-by-base.md`)가 있고, 쓰는 저장소에서 검사 하나가 사라지기 때문입니다.

이 제안 문서를 쓴 쪽의 판단입니다.

- 생성기에서 job 이 명령 하나 대신 단계의 목록을 갖게 넓혔습니다. push 워크플로는 단계 하나로 바꾸기 전과 같은 파일을 만듭니다.
- `check-pull-request` 를 앞에 두고, 그 단계가 실패하면 `check` 를 돌리지 않는 GitHub Actions 의 기본 동작을 그대로 두었습니다. 두 단계를 모두 돌리려면 둘째 단계에 `if` 가 더 들고, 짝이 틀린 pull request 는 어느 쪽이든 실패합니다. 설정 검사의 결과는 짝을 고친 뒤의 실행에서 나옵니다.
- 환경 변수를 job 이 아니라 단계마다 두었습니다. `BASE_REF` 와 `HEAD_REF` 를 `check` 단계에 주지 않습니다.
- 규칙 문서와 README 에, 워크플로가 도는 때와 base 를 바꾼 뒤 검사를 다시 돌리는 방법을 적었습니다.
- style-guide 저장소 자신의 `.github/workflows/branch-flow.yml` 은 바꾸지 않았습니다. 이 저장소는 공개 저장소라 표준 러너의 사용 분이 청구되지 않습니다. 그 워크플로는 job 하나로 `master` 의 규칙 묶음이 필수로 거는 `pull request pairing into master` 를 돌리므로, `edited` 를 빼면 이 저장소에서 base 를 바꾼 pull request 가 다음 push 까지 막힙니다.
- 테스트의 모양입니다. `test/cli/setup.test.mjs` 가 job 이 하나이고, 마지막 두 단계가 `check-pull-request` 와 `check` 의 순서이고, `edited` 와 `style guide setup` 이 없고, `BASE_REF` 와 `HEAD_REF` 가 `check-pull-request` 단계에만 있다는 것을 확인합니다.

## 근거

사용 분입니다. 이 패키지를 쓰는 비공개 저장소 하나에서 2026-10-08 00:00Z 부터 2026-10-10 약 12:30Z 까지 잰 값입니다. 조율 세션이 그 저장소의 실행 기록과 조직 사용 보고서에서 모아 전했고, 이 제안 문서를 쓴 쪽은 원자료를 다시 세지 않았습니다.

- 이 워크플로가 98회 돌았고 job 은 196개였습니다. job 의 실행 시간은 평균 9.2초, 최대 18초였습니다.
- 청구된 분은 196분으로, 그 저장소 전체 415분의 47% 였습니다. job 마다 분 단위로 올린 합이 조직 사용 보고서와 날마다 같았습니다.
- 같은 커밋에서 다시 돈 실행은 25회였습니다. pull request 타임라인의 편집 시각과 실행 시작 시각을 견주면 본문 수정 21회, base 변경 3회, 제목 수정 1회였습니다. 25회 가운데 24회가 편집 2~5초 뒤에 시작했습니다.
- 같은 자료에 적용한 절감은 job 하나로 합치기만 98분, `edited` 빼기만 50분, 둘 다 123분입니다. 둘 다 적용하면 196분이 73분이 됩니다. 이 제안 문서를 쓴 쪽이 다시 계산해 같은 값을 얻었습니다. 98회의 job 이 하나씩이면 98분이고, `edited` 로 돈 25회의 job 둘이 빠지면 50분이 줄고, 둘 다 적용하면 73회의 job 하나씩이라 73분입니다.

GitHub Docs 의 문서입니다. 2026-10-10 에 읽었습니다.

- "Actions runner pricing", https://docs.github.com/en/billing/reference/actions-runner-pricing
  - "GitHub rounds the minutes and partial minutes each job uses up to the nearest whole minute."
- "GitHub Actions billing", https://docs.github.com/en/billing/concepts/product-billing/github-actions
  - "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners." 원문의 굵은 글씨 표시는 뺐습니다.
- "Using conditions to control job execution", https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions
  - "A job that is skipped will report its status as "Success". It will not prevent a pull request from merging, even if it is a required check."
- "About protected branches", https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
  - "Required status checks must have a `successful`, `skipped`, or `neutral` status before collaborators can make changes to a protected branch."

필수 검사가 같은 커밋의 같은 이름 결과 가운데 가장 나중 것을 쓴다는 것은 `rfcs/name-the-pairing-check-by-base.md` 의 관찰입니다. 같은 커밋에 `failure` 뒤 `success` 가 붙자 pull request 의 상태가 `CLEAN` 이 되었습니다.

코드입니다. 원격 `develop` 의 `a8a2884` 를 읽었습니다.

- `cli/commands/merge.mjs:21` 은 머지할 때 pull request 의 `baseRefName` 과 `headRefName` 을 조회하고, `cli/commands/merge.mjs:94` 가 그 값으로 `planMerge` 를 부릅니다. `planMerge`(`cli/lib/branch-flow.mjs:250-265`)는 `:255` 에서 `decideMerge` 를 부릅니다.
- `decideMerge`(`cli/lib/branch-flow.mjs:186-203`)는 base 가 `develop` 이면 작업 브랜치만 받고(`:187-193`), `master` 이면 `develop` 만 받고(`:194-199`), 그 밖의 base 는 거절합니다(`:200-202`). 검사가 돌지 않은 base 변경 뒤에도 이 명령은 흐름 밖의 짝을 머지하지 않습니다.
- 머지 뒤에는 `init` 이 두는 push 워크플로의 `landed commit` 검사가 `check-landed-commit` 을 돌립니다(`cli/commands/check-landed-commit.mjs:97`). `landedCommitProblem`(`cli/lib/branch-flow.mjs:355-377`)은 올라온 커밋의 pull request 가 그 브랜치를 base 로 두었는지(`:368-369`)와 짝이 흐름에 맞는지(`:370-371`)를 봅니다.

이 변경의 검사입니다.

- 구현하기 전에 `test/cli/setup.test.mjs` 의 테스트 3건이 실패했습니다. "runs when a pull request is opened, reopened or pushed to, and not when it is edited", "has one job, the pairing job, with read-only contents", "runs check-pull-request and then check, as the last two steps of that job" 입니다. 트리거에 `edited` 가 있고 job 이 둘이라는 것이 실패의 이유였습니다.
- `npm run test:flow` 362건, `npm test` 32건이 통과했고 `npm run typecheck` 는 오류 없이 끝났습니다.
- 생성된 pull request 워크플로를 `yaml` 패키지 2.6.1 로 파싱해, job 하나에 단계 넷이 있고 두 명령 단계의 환경 변수가 위와 같은 것을 확인했습니다.
- push 워크플로와 스킬 파일은 바꾸기 전 생성기의 출력과 문자열이 같습니다.

확인하지 않은 것은 다음과 같습니다.

- 합친 워크플로를 실제 GitHub Actions 에서 돌리지 않았습니다. 이 RFC 를 게시한 뒤 처음 버전을 올리는 저장소의 pull request 에서, `pull request pairing into <base>` 검사 하나만 생기고 그 job 이 두 명령을 차례로 돌리는지 보면 확인됩니다.
- 합친 job 의 실행 시간을 재지 않았습니다. job 하나가 가장 길게 18초였으므로 둘을 합쳐도 1분을 넘지 않을 것으로 봅니다. 1분을 넘으면 이벤트 하나가 2분으로 청구됩니다. 위 저장소에서 버전을 올린 뒤 그 job 의 실행 시간을 읽으면 확인됩니다.
- base 를 바꾸면 `edited` 가 온다는 것은 위 관찰의 base 변경 3회로만 봤습니다. 읽은 webhook 문서의 본문은 활동 종류의 이름만 적었습니다.
- 필수 검사가 보고되지 않은 커밋에서 머지가 막힌다는 것은 "About protected branches" 의 문장으로만 봤고, 이 변경에서 실험하지 않았습니다. 짝 검사를 필수로 건 시험 저장소에서 pull request 의 base 를 바꾸고 머지 상자를 보면 확인됩니다.
- 스택에서 아래 층이 머지된 뒤 GitHub 가 위 층의 base 를 `develop` 으로 바꾸고 서버에서 rebase 할 때, `synchronize` 가 와서 새 base 의 짝 검사가 도는지 확인하지 않았습니다. 오지 않으면 위 층은 다음 push 나 다시 열기까지 `pull request pairing into develop` 이 없습니다. 이 검사를 `develop` 에 필수로 건 저장소에서만 머지가 막힙니다. 시험 저장소에서 두 층의 스택을 만들고 아래 층을 머지한 뒤 위 층의 검사 목록을 보면 확인됩니다.

## 쓰는 저장소에 미치는 영향

- 판정은 바뀌지 않습니다. 짝과 설정이 맞는 pull request 는 통과하고, 틀린 pull request 는 실패합니다. lint 설정, TypeScript 설정, 훅, push 워크플로, 스킬 파일은 바뀌지 않습니다.
- 새 버전으로 올린 뒤 `init` 을 다시 돌리지 않으면 `style-guide check` 가 `differs: .github/workflows/style-guide-pull-request.yml` 로 실패합니다. 버전을 올리는 pull request 에서 `init` 을 돌리고 바뀐 워크플로를 커밋합니다.
- 검사 이름 `style guide setup` 은 사라집니다. 그 이름을 필수 검사로 건 저장소는 필수 검사에서 뺍니다. 빼지 않으면 pull request 가 오지 않는 검사를 기다립니다. 그 이름을 문서나 스크립트에 적은 저장소는 고칩니다.
- `pull request pairing into <base>` 를 필수 검사로 건 저장소에서는 설정 검사도 함께 필수가 되어 더 엄격해집니다. 짝 검사는 통과하고 `style guide setup` 만 실패하는 pull request 는, `style guide setup` 을 필수로 걸지 않은 저장소에서 지금은 머지되지만 이 변경 뒤에는 막힙니다.
- base 를 바꾼 pull request 는 다음 push 나 다시 열기까지 새 base 의 짝 검사가 돌지 않습니다. 그 검사를 필수로 건 저장소에서는 그동안 머지가 막힙니다. head 에 커밋을 push 하거나 pull request 를 닫았다 다시 열면 검사가 돕니다.

## 이전 제안

- `rfcs/ship-setup-and-branch-flow-commands.md` 의 "쓰는 저장소에 미치는 영향" 은 `init` 이 둔 것을 지우거나 고친 pull request 가 `style guide setup` 에서 실패한다고 적었습니다. 이 RFC 뒤에는 `pull request pairing into <base>` 에서 실패합니다.
- `rfcs/name-the-generated-pairing-check-by-base.md` 의 "쓰는 저장소에 미치는 영향" 첫 항목이 적은 `differs` 실패도 이 RFC 뒤에는 `pull request pairing into <base>` 에서 납니다. 그 RFC 가 정한 짝 검사의 이름은 그대로입니다.
