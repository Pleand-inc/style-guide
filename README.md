# style-guide

Pleand 의 TypeScript 코드 규칙을 담는 저장소입니다. 규칙 문서와 lint, TypeScript 설정을 `@pleand-inc/style-guide` 패키지로 GitHub Packages 에 게시합니다.

버전 `0.0.1` 은 게시와 설치 경로를 확인하는 판입니다. 규칙과 설정은 아직 들어 있지 않습니다.

## 게시

`v` 로 시작하는 태그를 push 하면 `.github/workflows/publish.yml` 이 패키지를 게시합니다. 태그의 이름은 `v` 뒤에 `package.json` 의 `version` 을 붙인 값과 같아야 합니다.
