# style-guide

Pleand 의 TypeScript 코드 규칙을 담는 저장소입니다. 규칙 문서와 lint, TypeScript 설정을 `@pleand-inc/style-guide` 패키지로 GitHub Packages 에 게시합니다.

지금 게시된 버전은 게시와 설치 경로를 확인하는 판입니다. 규칙과 설정은 아직 들어 있지 않습니다.

## 규칙을 바꿀 때

규칙, 설정, 플러그인은 RFC 로 바꿉니다. 절차는 `rfcs/README.md` 에 있습니다.

## 게시

`v` 로 시작하는 태그를 push 하면 `.github/workflows/publish.yml` 이 패키지를 게시합니다. 태그의 이름은 `v` 뒤에 `package.json` 의 `version` 을 붙인 값과 같아야 합니다.

## 라이선스

Copyright 2026 Pleand Inc.

이 저장소의 파일은 Mozilla Public License 2.0 을 따릅니다. 전문은 `LICENSE` 에 있습니다.
