# develop 은 rebase 머지도 받고, 복구 머지는 우회 없이 규칙 묶음을 잠시 꺼서 합니다

## 바꾸는 것

규칙 문서 `rules/git/branch-flow/RULES.md`:

- 지금: `develop` 은 작업 브랜치의 squash 커밋만 받습니다. 규칙 묶음은 `develop` 에 squash 만 허용합니다. style-guide 저장소는 `develop` 의 규칙 묶음에서 저장소 관리자에게 pull request 에 한해 우회를 허용하고, 복구 머지는 관리자가 그 우회로 복구 pull request 의 head 커밋을 `develop` 으로 push 합니다. `check-landed-commit` 의 설명은 "`develop` 의 커밋은 부모가 하나여야" 한다고만 적습니다.
- 이 RFC 뒤:
  - `develop` 은 작업 브랜치의 squash 커밋이나, pull request 의 커밋을 rebase 한 커밋을 받습니다. `style-guide merge` 는 지금처럼 squash 로 머지하고, rebase 머지는 GitHub 웹의 머지 버튼에서 "Rebase and merge" 를 골라 합니다. 커밋에 머지 커밋이나 빈 커밋이 있거나 커밋이 100개를 넘는 pull request 는 rebase 로 머지하지 않고 squash 로 머지합니다. 스택 안의 pull request 도 rebase 로 머지하지 않고, 지금처럼 `style-guide merge` 로 한 층씩 squash 로 머지합니다.
  - "스택 pull request" 의 "Merge stack" 버튼: 지금은 그 버튼이 올린 push 를 `check-landed-commit` 이 실패로 남긴다고 적습니다. 이 RFC 뒤에는 버튼을 쓰지 않는다는 규칙은 그대로 두고, 그 push 가 실패하는 것은 머지된 맨 위 pull request 의 응답에 `stack` 이 남을 때이고, 남지 않으면 통과할 수 있다고 적습니다.
  - 규칙 묶음은 `master` 와 `develop` 을 pull request 로만 바꾸게 하고, 두 브랜치를 지우거나 강제 push 하지 못하게 합니다. `develop` 에는 squash 와 rebase 를, `master` 에는 머지 커밋만 허용합니다. 규칙 묶음에는 우회 대상을 두지 않고, style-guide 저장소도 같습니다.
  - 복구 머지: 규칙 묶음을 바꿀 권한이 있는 사람이 `develop` 을 막는 규칙 묶음의 enforcement 를 잠시 `disabled` 로 바꿉니다. 그동안 복구 pull request 를 머지 커밋으로 머지하거나 그 head 커밋으로 `develop` 을 옮기고, 끝나면 곧바로 `active` 로 되돌립니다. `style-guide merge` 는 `develop` 으로 squash 하므로, 머지 커밋은 `gh pr merge <번호> --merge` 나 웹의 "Create a merge commit" 으로 만듭니다. 조직의 규칙 묶음을 끄면 그 규칙 묶음이 걸린 모든 저장소가 풀리므로, 그 대신 규칙 묶음의 저장소 조건에서 복구할 저장소 하나만 잠시 빼도 됩니다. 저장소를 이름(`repository_name`)이나 속성(`repository_property`)으로 고르는 규칙 묶음에서는 그 저장소를 제외(`exclude`)에 넣었다가 지웁니다. 제외는 이 두 조건에만 있으므로, 저장소 ID 목록(`repository_id` 의 `repository_ids`)으로 고르는 규칙 묶음에서는 그 목록에서 그 저장소의 ID 를 지웠다가 다시 넣습니다. 어느 쪽이든 뺀 동안 그 저장소에서는 그 규칙 묶음이 막는 브랜치가 모두 풀립니다. 그 규칙 묶음이 `master` 도 막으면 그 저장소의 `master` 도 풀립니다. 복구 머지의 커밋에 대한 `check-landed-commit` 실패는 예상한 것이므로 받아들이고, 그 커밋을 되돌리지 않습니다.
  - "저장소에 적용하기" 의 `check-landed-commit` 설명에 rebase 머지를 통과시키는 조건을 적습니다. 커밋이 pull request 의 `merge_commit_sha` 라는 뜻으로 적던 "pull request 의 머지 커밋" 은 `merge_commit_sha` 로 적어, 부모가 둘인 머지 커밋과 구별합니다.

저장소 루트의 `README.md` 의 "브랜치 흐름" 은 `style-guide merge` 가 `develop` 으로 squash 하고, rebase 는 웹의 "Rebase and merge" 로, 복구 pull request 는 `gh pr merge <PR 번호> --merge` 나 웹의 "Create a merge commit" 으로 머지한다고 적습니다.

검사 `style-guide check-landed-commit`:

- 지금: push 가 `master` 나 `develop` 을 첫 부모를 따라 커밋 하나보다 많이 옮기면 `<브랜치> moved from <이전 SHA> to <새 SHA> by more than one first-parent commit` 로 실패하고, 그 아래에 push 이벤트가 적은 커밋 목록과 다음에 할 일을 적습니다. 커밋이 둘 이상인 pull request 를 rebase 로 머지한 push 가 여기에 걸립니다.
- 이 RFC 뒤: `develop` 을 커밋 여럿만큼 옮긴 push 는 아래 일곱 조건을 모두 채우면 통과합니다.
  1. 맨 위 커밋이 머지된 pull request 의 `merge_commit_sha` 이고, 그 pull request 는 base 가 `develop` 이고 짝이 흐름에 맞습니다.
  2. 맨 위 커밋은 그 pull request 의 `head.sha` 가 아닙니다.
  3. 그 pull request 의 `commits` 는 2 이상 100 이하입니다.
  4. 맨 위 커밋에서 첫 부모를 따라 `commits` 만큼 내려가면 push 의 `before` 에 닿습니다.
  5. 그 사이의 커밋은 모두 부모가 하나입니다.
  6. `GET /repos/{owner}/{repo}/pulls/{number}/commits?per_page=100` 이 `commits` 와 같은 수의 커밋을 돌려주고, `before` 바로 위부터 맨 위 커밋까지의 커밋이 그 목록의 커밋과 차례대로 메시지, 작성자의 이름, 작성자의 이메일이 같습니다.
  7. 그 pull request 의 `GET /repos/{owner}/{repo}/pulls/{number}` 응답에 스택을 적은 `stack` 객체가 없습니다(검사는 `stack` 에 값이 있으면 스택으로 봅니다). 곧 그 pull request 는 GitHub 가 스택 안에 있다고 적은 pull request 가 아닙니다.
- 조건 2, 3, 7 은 `GET /repos/{owner}/{repo}/pulls/{number}` 응답 하나로 봅니다. 조건 6 의 목록은 이 응답을 본 뒤에만 읽고, 걷기는 그 목록을 읽은 뒤에 합니다. 조건 7 을 어긴 push 는 조건 2, 3 을 어긴 push 처럼 목록도 걷기도 읽지 않습니다.
- 그 밖에 브랜치를 커밋 여럿만큼 옮긴 push 는 지금과 같은 메시지와 같은 커밋 목록으로 실패합니다. 다음 두 경우에만 커밋 목록 아래, 다음에 할 일의 줄 위에 줄 하나가 더 붙습니다.
  - 조건 1 을 채운 push 에서 위 요청이 실패하거나 응답이 문서와 다를 때: `Whether the push is the rebase merge of #<번호> could not be checked: <이유>`. 이유는 `GET <주소>: HTTP 502` 처럼 요청과 상태, 또는 응답에서 빠진 값입니다. 지금은 이런 push 가 이 요청을 하지 않습니다.
  - 그 pull request 의 `commits` 가 100 을 넘을 때: `Whether the push is the rebase merge of #<번호> was not checked: #<번호> has <수> commits, and a pull request with more than 100 commits is squashed, not rebased`.
- `master` 의 판단은 바뀌지 않습니다. 커밋 하나만큼 옮긴 push 의 판단도 바뀌지 않고, 부모가 둘인 커밋이 `develop` 에 올라왔을 때의 메시지 끝만 `develop takes squash commits` 에서 `develop takes squash commits or rebased commits` 로 바뀝니다.

GitHub 에 하는 요청의 수:

- 지금 이 검사는 모든 push 에서 맨 위 커밋의 `GET /repos/{owner}/{repo}/commits/{sha}` 와 `GET /repos/{owner}/{repo}/commits/{sha}/pulls` 를 합니다(2개). 커밋 여럿만큼 옮긴 push 가 실패하면, push 이벤트가 적은 커밋 가운데 앞의 20개에서 맨 위 커밋을 뺀 커밋마다 `GET /repos/{owner}/{repo}/commits/{sha}/pulls` 를 한 번 더 합니다. 이 수를 K 라 합니다(0 ≤ K ≤ 20). 이벤트는 커밋을 오래된 것부터 적으므로, 커밋 N 개를 올린 push 의 K 는 N ≤ 20 이면 N − 1 이고 N > 20 이면 20 입니다.
- squash 머지가 통과할 때: 2개. 바뀌지 않습니다.
- 커밋 N 개(2 ≤ N ≤ 100)인 pull request 의 rebase 머지가 통과할 때: 2 + 1(`GET /pulls/{number}`) + 1(`GET /pulls/{number}/commits`) + (N − 1)(맨 위 아래의 커밋마다 `GET /commits/{sha}`; 맨 위 커밋은 이미 읽은 응답을 씁니다) = N + 3개. squash 머지보다 N + 1개 많습니다. N = 3 이면 6개, N = 100 이면 103개입니다.
  - 같은 push 가 지금은 실패하면서 2 + K 개를 요청합니다. N ≤ 20 이면 2 + (N − 1) = N + 1개로 이 RFC 뒤보다 2개 적고, N > 20 이면 2 + 20 = 22개입니다.
- 커밋 여럿만큼 옮긴 push 가 실패할 때, 지금은 2 + K 개입니다. 이 RFC 뒤에는:
  - 조건 1 을 채우지 않거나 `master` 의 push 이면: 2 + K 개. 지금과 같습니다.
  - 조건 1 을 채우고 조건 2, 3, 7 가운데 하나를 어기면: 2 + 1 + K = K + 3개. 지금보다 1개 많습니다. 조건 7 은 조건 2, 3 과 같은 응답에서 보므로 이 수를 늘리지 않습니다.
  - 조건 1~3 과 조건 7 을 채우고 조건 4~6 에서 실패하면: 2 + 1 + 1 + W + K = K + W + 4개. W 는 걷기가 맨 위 커밋 아래에서 읽은 커밋의 수이고 0 ≤ W ≤ N − 1 입니다. 걷기는 `commits` 만큼 읽었거나, `before` 에 닿았거나, 부모가 하나가 아니거나 메시지나 작성자가 다른 커밋을 만나면 멈춥니다. 지금보다 W + 2개, 많아야 N + 1 ≤ 101개 많습니다. 스택의 층 여럿을 squash 로 한 번에 올린 push 는, 맨 위 pull request 의 응답에 `stack` 이 남아 있으면 조건 7 에서 멈춰 K + 3개이고, 남지 않았으면 맨 위 커밋의 메시지가 맨 위 pull request 의 마지막 커밋과 다를 때 W = 0 입니다.
  - 요청이 도중에 실패하면: 실패한 요청까지의 요청에 K 개를 더한 수입니다.
  - push 하나가 하는 요청은 많아야 2 + 1 + 1 + 99 + 20 = 123개입니다.

## 이유

조직의 관리자가 조직의 규칙 묶음으로 모든 저장소의 브랜치 흐름을 강제하기로 정했습니다. `master` 와 `develop` 은 pull request 로만 바뀌고, 지우거나 강제 push 할 수 없습니다. `master` 는 머지 커밋만, `develop` 은 squash 와 rebase 를 받습니다. 어느 규칙 묶음에도 우회 대상이 없고, 머지된 head 브랜치는 자동으로 지워집니다.

이 패키지의 규칙과 검사가 그 결정과 맞지 않습니다.

- 규칙 문서는 `develop` 이 squash 커밋만 받는다고 적습니다.
- `check-landed-commit` 은 커밋이 둘 이상인 pull request 의 rebase 머지를 실패로 남깁니다. 규칙 묶음이 허용한 머지가 검사에서 실패합니다.
- 이전 RFC 의 복구 머지는 `develop` 의 규칙 묶음에 둔 관리자 우회에 기댑니다. 우회 대상이 없는 규칙 묶음에서는 그 절차가 되지 않습니다.

조건 2, 3, 6, 7 은 이 제안 문서를 쓴 쪽이 더한 것입니다.

- 조건 6: 조건 1, 4, 5 만 두면, 스택의 층 여럿을 GitHub 웹의 "Merge stack" 버튼에서 squash 로 한 번에 올린 push 가 맨 위 pull request 의 커밋 수와 층의 수가 같을 때 통과합니다. 각 층의 squash 커밋은 부모가 하나이고 첫 부모를 따라 이어지기 때문입니다. 규칙 문서는 그 버튼을 쓰지 않는다고 적으므로, 그 push 는 통과해서는 안 됩니다. rebase 머지는 pull request 의 커밋을 하나씩 새 커밋으로 옮기면서 커밋마다 메시지와 작성자를 그대로 둔다고 보았습니다(아래 "확인하지 않은 것"). 스택의 squash 커밋은 층마다 하나이고, 그 메시지는 그 층의 pull request 에서 만든 것입니다. 그래서 맨 위 pull request 의 커밋 목록과 차례대로 견주면 squash 커밋이 걸러집니다. 이 견줌은 pull request 하나의 커밋 목록을 한 번 읽어서 하고, 걷기에서 커밋마다 `GET /repos/{owner}/{repo}/commits/{sha}/pulls` 를 부르지 않습니다.
- 조건 2: pull request 의 커밋을 그대로 `develop` 에 올린 push 는 조건 1, 4, 5, 6 을 모두 채울 수 있습니다. GitHub 의 rebase 머지는 언제나 새 SHA 를 만들므로, 맨 위 커밋이 pull request 의 head 이면 rebase 머지가 아닙니다. 이 값은 조건 3 과 같은 응답에 있어 요청이 늘지 않습니다.
- 조건 3: 걷기는 pull request 의 커밋마다 요청을 하나 합니다. 상한을 두어 push 하나의 요청을 위의 123개 이하로 묶고, 조건 6 의 목록을 한 페이지(100개)에 담습니다. 아래 문서에서 `GITHUB_TOKEN` 은 저장소마다 한 시간에 1,000개까지 요청할 수 있습니다. 하한 2 는 커밋 여럿만큼 옮긴 push 가 커밋 하나인 pull request 의 rebase 머지일 수 없다는 데서 옵니다. 하한에 걸리는 push 는 조건 6 의 목록을 읽지 않습니다.
- 조건 7: 조건 6 의 견줌은 squash 로 올린 스택을 거르지만, rebase 로 올린 스택은 거르지 못할 수 있습니다. 아래 문서 "Stacked pull requests" 는 스택이 세 머지 방식을 모두 받고, rebase 는 층마다 pull request 의 커밋을 base 브랜치에 다시 놓는다고 적습니다. `develop` 의 규칙 묶음이 rebase 를 허용하므로, 서버는 "Merge stack" 을 rebase 로 하는 머지를 막지 않습니다. 그 push 의 맨 위 커밋이 맨 위 pull request 의 `merge_commit_sha` 이면, 그 아래 커밋은 층마다 옮긴 커밋이라 부모가 하나이고 메시지와 작성자가 그대로이므로 조건 2 와 5, 그리고 조건 6 의 메시지와 작성자 견줌을 채울 수 있습니다. 나머지를 채우는지는 두 가지에 달렸습니다. 머지 뒤 맨 위 pull request 의 base 가 `develop` 으로 읽히는지(아니면 조건 1 에서 멈춥니다), 그 pull request 의 `commits` 와 커밋 목록이 아래 층의 커밋까지 담는지(아니면 조건 3, 4, 6 가운데 하나에서 멈춥니다)입니다. 읽은 문서는 둘 다 적지 않습니다. 그래서 응답에 `stack` 이 있는 pull request 는 rebase 머지로 받지 않습니다. 이 값은 조건 2, 3 과 같은 응답에 있어 요청이 늘지 않고, `style-guide merge` 가 스택을 알아보는 데 이미 쓰는 `isStackedPullRequest` 로 읽습니다. 스택 안의 pull request 는 규칙 문서대로 한 층씩 squash 로 머지하므로, 이 조건이 막는 rebase 머지는 흐름이 쓰지 않는 머지입니다. 이 조건은 머지된 맨 위 pull request 의 응답에 `stack` 이 남아 있을 때만 그 push 를 거릅니다(아래 "확인하지 않은 것").

GitHub 요청이 실패한 경우를 통과로 바꾸지 않고, 지금의 실패 메시지와 커밋 목록을 그대로 둔 채 이유를 한 줄 더합니다. 이 요청은 지금 실패하던 push 에만 더해진 것이므로, 그 요청이 실패했다고 메시지를 오류 한 줄로 바꾸면 지금 남기던 커밋 목록이 사라집니다.

## 근거

읽은 문서:

- GitHub REST API "Get a pull request" (https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request): "If rebased, merge_commit_sha represents the commit that the base branch was updated to." 응답 스키마에 `commits`: required, integer 가 있고, `head` 객체에 `sha`: required, string 이 있습니다. 이 응답의 스키마는 "Same response schema as Create a pull request." 이고, 그 스키마에 `stack`: `Pull Request Stack` 이 required 표시 없이 있습니다. 그 아래 필드는 `base`(required, `ref` 와 `sha`), `size`, `position`, `id`, `number` 입니다. 이 문서는 `stack` 이 언제 응답에 있는지, 머지된 pull request 에도 남는지 적지 않습니다.
- GitHub 문서 "Stacked pull requests" (https://docs.github.com/en/pull-requests/reference/stacked-pull-requests): "Stacks support all three merge methods. In each case, the pull requests land as a single atomic operation", "**Rebase** replays the commits from each pull request onto the base branch, creating a linear history without merge commits." 그리고 "Stack metadata, such as the stack's base branch, is available in workflow expressions via `github.event.pull_request.stack`. This property is present only when the pull request belongs to a stack." 이 마지막 문장은 워크플로의 이벤트를 두고 한 말이고, REST 응답을 두고 한 말은 아닙니다.
- GitHub REST API "List commits on a pull request" (https://docs.github.com/en/rest/pulls/pulls#list-commits-on-a-pull-request): "Lists a maximum of 250 commits for a pull request. To receive a complete commit list for pull requests with more than 250 commits, use the List commits endpoint." `per_page` 는 "The number of results per page (max 100)." 이고 기본값은 30 입니다. 조건 3 의 상한 100 과 `per_page=100` 으로 목록은 한 페이지이고 250개 제한에 닿지 않습니다. 다음 페이지는 읽지 않습니다. 목록이 `commits` 보다 짧거나 길면 조건 6 이 실패하므로, 잘린 목록으로는 통과하지 않습니다.
- GitHub REST API "List pull requests associated with a commit" (https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit): 응답은 `Pull Request Simple` 의 배열입니다. 이 스키마에는 정수 `commits` 가 없고 `_links.commits` 링크만 있습니다. 그래서 검사가 이미 부르는 이 목록으로는 커밋 수를 알 수 없고, "Get a pull request" 를 한 번 더 부릅니다.
- GitHub 문서 "About pull request merges" (https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges): rebase and merge 는 "Always updates the committer information and creates new commit SHAs" 이고, "Drops commits that were empty to begin with" 입니다. 빈 커밋이 있는 pull request 를 rebase 로 머지하면 `develop` 에 올라간 커밋이 pull request 의 커밋 수보다 적어 조건 4 를 채우지 못하므로, 규칙 문서는 그런 pull request 를 squash 로 머지한다고 적습니다.
- GitHub REST API "Rate limits for the REST API" (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api): "The rate limit for `GITHUB_TOKEN` is 1,000 requests per hour per repository." GitHub Enterprise Cloud 계정의 자원에는 저장소마다 한 시간에 15,000개입니다.
- GitHub "REST API endpoints for rules" 의 "Update an organization repository ruleset" (https://docs.github.com/en/rest/orgs/rules#update-an-organization-repository-ruleset): 규칙 묶음의 `enforcement` 는 `disabled`, `active`, `evaluate` 가운데 하나입니다. pull request 규칙의 `allowed_merge_methods` 는 `merge`, `squash`, `rebase` 를 받습니다.
- 같은 문서의 "Create an organization repository ruleset" (https://docs.github.com/en/rest/orgs/rules#create-an-organization-repository-ruleset): 저장소 조건은 세 가지입니다. `repository_name` 은 `include` 와 `exclude` 를, `repository_property` 는 `include` 와 `exclude` 를 받고, `repository_id` 는 `repository_ids` 만 받습니다. `repository_ids` 는 "The repository IDs that the ruleset applies to. One of these IDs must match for the condition to pass." 입니다. 그래서 저장소 하나를 `exclude` 로 빼는 대안은 이름이나 속성으로 저장소를 고르는 규칙 묶음에서만 되고, ID 로 고르는 규칙 묶음에서는 `repository_ids` 에서 그 저장소의 ID 를 지웠다가 다시 넣습니다.
- GitHub REST API "Update a reference" (https://docs.github.com/en/rest/git/refs#update-a-reference): `force` 를 빼거나 `false` 로 두면 fast-forward 인 갱신만 받아들입니다. 규칙 문서는 복구 pull request 의 head 커밋으로 `develop` 을 옮기는 명령으로 이 API 를 적습니다. `init` 이 두는 pre-push 훅이 `develop` 으로 가는 `git push` 를 막기 때문입니다.
- GitHub "Permissions required for GitHub Apps" (https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps): `GET /repos/{owner}/{repo}/pulls/{pull_number}` 는 "Contents" 와 "Pull requests" 의 read 아래에, `GET /repos/{owner}/{repo}/pulls/{pull_number}/commits` 는 "Pull requests" 의 read 아래에, `GET /repos/{owner}/{repo}/commits/{ref}` 는 "Contents" 의 read 아래에 있습니다.

바꾼 코드:

- `cli/lib/branch-flow.mjs`: `rebaseMergeCandidate` 가 조건 1 을, `canBeRebaseMergeOf` 가 조건 2, 3, 7 을 봅니다. 조건 7 은 `RebasedPull` 의 `stacked` 로 봅니다. `unwalkedRebaseMergeLine` 은 커밋이 100개를 넘는 pull request 의 줄을 만들고, 상한은 `REBASE_MERGE_COMMIT_LIMIT` 입니다. `nextCommitToWalk` 는 다음에 읽을 커밋을 정하고, `isRebaseMerge` 가 `canBeRebaseMergeOf` 를 다시 불러 일곱 조건을 모두 다시 봅니다. `landedCommitProblem` 은 커밋 여럿만큼 옮긴 push 가 `isRebaseMerge` 를 채우면 `null` 을 돌려줍니다. 이 파일은 지금처럼 네트워크를 쓰지 않습니다.
- `cli/lib/github-payloads.mjs`: `readPullRequestCommitCount` 는 음이 아닌 정수 `commits` 만 받습니다. `readPullRequestHeadSha` 가 `head.sha` 를, `readCommitIdentity` 와 `readPullRequestCommits` 가 커밋의 메시지와 작성자의 이름, 이메일을 읽습니다. 맨 위 커밋의 메시지와 작성자는 걷기를 할 때만 읽으므로, rebase 머지일 수 없는 push 는 그 값 때문에 실패하지 않습니다.
- `cli/commands/check-landed-commit.mjs`: `withRebaseWalk` 가 조건 1 을 채우는 push 에서만 pull request, 그 커밋 목록, 걷기의 커밋을 읽습니다. 이 읽기에서 나온 오류는 잡아서 위의 줄 하나로 바꿉니다. pull request 를 읽는 `pullOf` 는 `GET /pulls/{number}` 응답에서 `commits`, `head.sha` 와 함께 `stacked` 를 채웁니다. `stacked` 는 `cli/lib/github-payloads.mjs` 의 `isStackedPullRequest` 가 정합니다. 이 함수는 `style-guide merge` 가 이미 쓰던 것으로, 응답의 `stack` 이 truthy 이면 true 이고 이 RFC 에서 바꾸지 않습니다.

규칙에 맞는 push 와 어긋난 push 의 짝은 `test/cli/branch-flow.test.mjs` 와 `test/cli/check-landed-commit.test.mjs` 에 있습니다. 통과하는 쪽은 커밋 2개, 3개, 100개인 pull request 의 rebase 머지, 응답의 `stack` 이 `null` 인 pull request 의 rebase 머지, 그리고 squash 머지입니다. 실패하는 쪽은 걷기가 `before` 에 닿지 않는 push, 부모가 둘인 커밋을 만나는 push, 커밋 수가 맞지 않는 push, 커밋 목록의 수가 `commits` 와 다른 push, 메시지나 작성자의 이름이나 이메일이 다른 커밋이 있는 push, 커밋의 차례가 다른 push, 스택 한꺼번에 머지(맨 위 커밋의 메시지가 맨 위 pull request 의 마지막 커밋과 같은 경우 포함), 응답에 `stack` 이 있고 나머지 여섯 조건을 모두 채우는 pull request(지금과 같은 메시지와 커밋 목록으로 실패하고 커밋 목록을 읽지 않습니다), pull request 의 head 를 그대로 올린 push, `commits` 가 0 이거나 101 인 pull request, pull request 가 머지하지 않은 커밋 여럿의 push, 일곱 조건을 모두 채우지만 `master` 를 옮긴 push 입니다. GitHub 가 `GET /pulls/{number}` 에 HTTP 502 나 403 으로 답하거나, 커밋 목록이나 걷기의 커밋에 HTTP 502 로 답하거나, 응답에 값이 빠졌을 때 지금의 실패 메시지와 커밋 목록에 이유의 줄이 붙는 것도 시험합니다.

실행한 명령과 결과(이 저장소의 루트에서):

- `npm run test:flow`: tests 422, pass 422, fail 0.
- `npm run typecheck`: 오류 없이 끝났습니다.
- `npm test`: tests 32, pass 32, fail 0.
- 받아들이는 조건을 하나씩 뺀 복사본에서 `node --test test/cli/branch-flow.test.mjs test/cli/check-landed-commit.test.mjs test/cli/github-payloads.test.mjs` 를 돌렸습니다. 복사본은 저장소 밖에 만들었고 돌린 뒤 지웠습니다. 빼지 않은 복사본에서는 245개가 모두 통과했고, 245개 가운데 실패한 시험의 수는 다음과 같습니다. `develop` 에서만 걷는 조건(`landed.branch !== "develop"`)을 빼면 3개, 조건 2 를 빼면 3개, 조건 3 의 상한을 빼면 3개, 조건 3 의 하한을 빼면 6개, 조건 6 의 메시지와 작성자 비교를 빼면 6개, 조건 6 의 목록 수 비교를 빼면 1개, 조건 7 을 빼면 3개, 걷기의 오류를 잡지 않으면 6개입니다.

확인하지 않은 것은 다음과 같습니다.

- 실제 GitHub 저장소에서 rebase 머지를 하고 이 검사를 돌려 보지 않았습니다. 아래 네 가지는 그때 확인됩니다.
  - rebase 머지의 맨 위 커밋에 `GET /repos/{owner}/{repo}/commits/{sha}/pulls` 를 부르면 그 pull request 가 그 커밋을 `merge_commit_sha` 로 해서 나오는지. 나오지 않으면 그 push 는 지금처럼 실패합니다.
  - GitHub 가 rebase 머지의 커밋을 push 한 번으로 base 브랜치에 올리는지. 커밋마다 따로 올리면 push 마다 커밋 하나만큼 옮기고, 맨 위가 아닌 커밋은 머지된 pull request 의 `merge_commit_sha` 가 아니므로 `did not come from a merged pull request` 로 실패합니다.
  - rebase 머지가 커밋의 메시지와 작성자의 이름, 이메일을 그대로 두는지. 위 문서는 committer 를 바꾼다고만 적고 메시지와 작성자는 적지 않습니다. 바꾸면 조건 6 에서 실패합니다.
  - `GET /repos/{owner}/{repo}/pulls/{number}/commits` 가 커밋을 rebase 머지가 적용하는 차례, 곧 오래된 것부터 돌려주는지. 위 문서에는 차례가 적혀 있지 않습니다. 다르면 조건 6 에서 실패합니다.
  - 위 네 가지 가운데 어느 것이 예상과 다르면 rebase 머지가 실패로 남을 뿐이고, 흐름을 벗어난 push 가 통과하지는 않습니다.
- 머지 커밋이 든 pull request 를 GitHub 가 rebase 로 머지할 때 거부하는지, 머지 커밋을 버리는지, 다시 만드는지는 읽은 문서에 없습니다. 버리면 커밋 수가 줄어 조건 4 를, 다시 만들면 부모가 둘이라 조건 5 를 채우지 못하므로, 어느 쪽이든 이 검사는 통과시키지 않습니다. 규칙 문서가 그런 pull request 를 squash 로 머지한다고 적는 이유입니다.
- 조건 6 은 스택 머지가 올린 squash 커밋의 메시지가 맨 위 pull request 의 커밋 메시지와 다르다는 데 기댑니다. squash 커밋의 기본 메시지가 무엇인지는 위 문서에 "The default message can include the pull request title, pull request description, or commit information, depending on repository settings and the number of commits in the pull request." 로만 적혀 있습니다. 머지하는 사람이 층마다 squash 메시지를 맨 위 pull request 의 커밋 메시지와 차례대로 같게 고치고 작성자도 같으면, 맨 위 pull request 의 커밋 수와 층의 수가 같은 스택 한꺼번에 머지는 머지된 맨 위 pull request 의 응답에 `stack` 이 남지 않을 때 통과합니다.
- "Merge stack" 을 rebase 로 한 push 는 시험 저장소에서 만들어 보지 않았습니다. 그 push 를 조건 7 이 거르는지는 다음 세 가지에 달렸고, 셋 다 읽은 문서에 없습니다.
  - 머지된 pull request 의 `GET /repos/{owner}/{repo}/pulls/{number}` 응답에 `stack` 이 남는지. 남으면 조건 7 에서 실패합니다. 머지된 pull request 가 스택에서 빠져 `stack` 이 없거나 `null` 이면 조건 7 은 그 push 를 거르지 못합니다.
  - 머지 뒤 맨 위 pull request 의 base 가 `develop` 으로 읽히는지. 아래 층의 브랜치로 읽히면 조건 1 에서 실패합니다.
  - 맨 위 pull request 의 `commits` 와 `GET /pulls/{number}/commits` 가 아래 층의 커밋까지 담는지. 맨 위 층의 커밋만 담으면, 그 수가 1 이면 조건 3 에서, 2 이상이면 걷기가 그 수만큼 내려가도 `before` 에 닿지 않아 조건 4 에서 실패합니다.
  - 머지된 맨 위 pull request 의 응답에 `stack` 이 남지 않고, base 가 `develop` 으로 읽히고, 커밋 수와 목록이 모든 층의 커밋을 담으면, 그 push 는 통과합니다. 이것은 바로 위 squash 메시지를 고친 경우와 함께, 이 RFC 뒤에도 규칙 문서가 쓰지 않는다고 적는 머지가 통과할 수 있는 경로입니다.
  - 반대로 머지된 pull request 에도 `stack` 이 남으면, 스택 안의 pull request 하나만 rebase 로 머지한 push 도 커밋이 둘 이상이면 실패합니다. 규칙 문서는 스택 안의 pull request 를 rebase 로 머지하지 않는다고 적습니다.
- 규칙 묶음의 enforcement 를 끄고 ref 를 옮기는 복구 절차, `gh pr merge <번호> --merge` 로 복구 pull request 를 머지하는 절차, 그리고 저장소 조건에서 저장소 하나를 제외하거나 `repository_ids` 에서 그 ID 를 지우는 대안은 시험 저장소에서 해 보지 않았습니다.

## 쓰는 저장소에 미치는 영향

- 지금 `check-landed-commit` 이 실패로 남기는, 커밋이 2개 이상 100개 이하이고 응답에 `stack` 이 없는 pull request 의 `develop` rebase 머지가 통과합니다. 커밋 하나인 pull request 의 rebase 머지는 squash 커밋과 모양이 같아 지금도 통과합니다. 커밋이 100개를 넘는 pull request 의 rebase 머지는 지금처럼 실패하고, 그 이유의 줄이 붙습니다.
- 지금 통과하는 push 가 이 변경 뒤에 실패하는 경우는 없습니다. 새 조건은 실패하던 push 의 일부만 통과로 바꾸고, 커밋 하나만큼 옮긴 push 의 판단은 그대로입니다. 바뀌는 메시지는 부모가 둘인 `develop` 커밋의 메시지 끝 하나와, 위에서 적은 이유의 줄입니다.
- `style-guide init` 이 만드는 파일은 바뀌지 않습니다. push 워크플로는 이미 `contents: read` 와 `pull-requests: read` 권한으로 돌고(`cli/lib/templates.mjs` 의 `pushWorkflowFile`), 새로 부르는 `GET /repos/{owner}/{repo}/pulls/{pull_number}` 와 `GET /repos/{owner}/{repo}/pulls/{pull_number}/commits` 는 위 권한 문서에서 "Pull requests" 의 read 아래에 있습니다. 패키지 버전을 올린 뒤 `init` 을 다시 실행해도 그 파일들은 `unchanged` 입니다.
- 실패하는 push 하나의 요청은 위에 적은 만큼 늘어 많아야 123개이고, 커밋이 N 개인 pull request 의 rebase 머지는 통과할 때 N + 3개를 요청합니다.
- 복구 머지의 절차가 바뀝니다. 관리자 우회에 기대던 저장소는 규칙 묶음을 잠시 끄거나 저장소 조건에서 그 저장소를 잠시 빼는 절차로 바꿉니다.
- 규칙 묶음을 쓸 수 없는 저장소에서는 서버가 rebase 머지를 막지 않으므로 이 검사만 그 머지를 확인합니다.

## 이전 제안

`rfcs/required-pairing-check-and-admin-bypass.md` 가 둔 `develop` 의 관리자 우회와, 그 우회에 기댄 복구 머지 절차를 바꿉니다. 그 RFC 의 `master` 필수 검사는 바꾸지 않습니다.
