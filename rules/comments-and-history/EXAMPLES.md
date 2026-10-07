# 주석과 변경 이력 예시

## 이력은 주석이 아니라 티켓에 적습니다

어긋난 코드입니다. 값이 언제, 어떻게 바뀌었는지를 주석에 적었습니다.

```ts
// 2026년 9월까지는 영문 값(fashion 등)이었고 그 뒤 한글 값으로 바뀌었다.
export const SKIN_CATEGORIES = ["패션", "가전", "가구", "식품"] as const;
```

맞는 코드입니다. 코드에는 티켓의 식별자만 남깁니다.

```ts
// .decisions/4a10b23a
export const SKIN_CATEGORIES = ["패션", "가전", "가구", "식품"] as const;
```

바뀐 사정은 `.decisions/4a10b23a.md` 에 적습니다.

```md
# 스킨 category 값을 영문에서 한글로 바꿈

2026년 9월까지 category 값은 영문(`fashion` 등)이었습니다. 그 뒤로 한글 값만 받습니다.
영문 값이 든 메타는 해석 단계에서 거부합니다.
```

식별자 `4a10b23a` 는 위 내용을 적은 파일의 해시에서 얻습니다.

```sh
git hash-object .decisions/draft.md
# 4a10b23aae533bedaf6aa1fbae581f3ac46de951
mv .decisions/draft.md .decisions/4a10b23a.md
```

## 티켓의 내용이 코드와 맞지 않게 되면 새 티켓을 만듭니다

영문 category 값을 거부하지 않고 한글 값으로 바꿔서 받도록 코드를 고친 경우입니다. `origin/develop` 브랜치에 있는 티켓 `.decisions/4a10b23a.md` 는 영문 값을 거부한다고 적고 있습니다.

어긋난 방법입니다. `.decisions/4a10b23a.md` 의 내용을 고쳤습니다. 이 파일에 `git hash-object` 를 실행하면 `4a10b23a` 로 시작하지 않는 해시가 출력됩니다.

맞는 방법입니다. 새 티켓 `.decisions/7dba3b5f.md` 를 만들어 본문에 이전 티켓의 식별자를 적고, 코드의 주석에 새 티켓의 식별자를 적습니다.

```md
# 영문 category 값을 한글 값으로 바꿔서 받음

2026년 10월부터 영문 category 값(`fashion` 등)이 든 메타를 거부하지 않고, 영문 값을 한글 값으로 바꿔서 받습니다.
2026년 9월에 category 값을 한글로 바꾼 뒤에도 영문 값이 든 메타 파일이 남아 있었습니다.
이전 티켓은 `4a10b23a` 입니다.
```

```ts
export const SKIN_CATEGORIES = ["패션", "가전", "가구", "식품"] as const;

// .decisions/7dba3b5f
export const SKIN_CATEGORY_BY_ENGLISH_NAME = {
  fashion: "패션",
  appliance: "가전",
  furniture: "가구",
  food: "식품",
} as const satisfies Record<string, (typeof SKIN_CATEGORIES)[number]>;
```

식별자 `4a10b23a` 는 코드의 어느 주석에도 남지 않았으므로, 이전 티켓을 `.decisions/.retired/` 폴더로 옮깁니다.

```sh
git mv .decisions/4a10b23a.md .decisions/.retired/4a10b23a.md
```

## 주석에는 코드로 표현할 수 없는 이유만 적습니다

어긋난 코드입니다. 주석이 함수의 이름과 본문이 이미 말하는 내용을 되풀이합니다.

```ts
/** 갤러리 캐시를 지운다. KV 삭제가 실패하면 그 오류를 그대로 올린다. */
export async function invalidateGalleryCache(env: { GALLERY_KV: Pick<KVNamespace, "delete"> }) {
  await env.GALLERY_KV.delete("gallery:list");
}
```

맞는 코드입니다. `cooldownDuration: 0` 을 넣은 이유는 코드만 읽어서는 알 수 없으므로 주석으로 적습니다.

```ts
import { createRemoteJWKSet } from "jose";

export function accessKeySet(teamDomain: string) {
  // jose 는 마지막 조회 뒤 30초 동안 모르는 kid 를 다시 조회하지 않는다. 0 으로 두어야 키가 바뀐 직후의 요청이 통과한다.
  return createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain), { cooldownDuration: 0 });
}
```

## JavaScript 파일과 설정 파일의 주석에도 같은 규칙을 적용합니다

`scripts/` 아래의 `.mjs` 파일인 경우입니다.

어긋난 코드입니다. 주석이 상수의 이름이 이미 말하는 내용을 되풀이합니다.

```js
/** 스킨 압축 파일의 확장자 목록이다. */
export const SKIN_ARCHIVE_EXTENSIONS = [".zip", ".tar.gz"];
```

맞는 코드입니다. 주석을 적지 않습니다.

```js
export const SKIN_ARCHIVE_EXTENSIONS = [".zip", ".tar.gz"];
```

## 새로 쓴 코드의 이유는 주석과 티켓에 나누어 적습니다

어긋난 코드입니다. 정한 날짜, 선택하지 않은 방법, 측정값을 주석에 적었습니다.

```ts
// 2026년 10월에 정함. 파일을 하나씩 올리는 방법은 요청이 300번 필요해서 선택하지 않았고, 50개씩 올리면 4.1초가 걸렸다.
export const SKIN_UPLOAD_BATCH_SIZE = 50;
```

맞는 코드입니다. 값이 50 인 이유는 코드만 읽어서는 알 수 없으므로 주석으로 적습니다. 날짜, 선택하지 않은 방법, 측정값은 이유와 함께 티켓에 적고 코드에는 티켓의 식별자를 적습니다.

```ts
// 업로드 API 는 요청 하나에 파일을 50개까지 받는다.
// .decisions/586603fd
export const SKIN_UPLOAD_BATCH_SIZE = 50;
```

`.decisions/586603fd.md` 의 내용입니다.

```md
# 스킨 파일을 요청 하나에 50개씩 올리도록 정함

2026년 10월에 스킨 파일의 업로드 묶음 크기를 50개로 정했습니다.
업로드 API 가 요청 하나에 파일을 50개까지 받기 때문입니다.
파일을 하나씩 올리는 방법은 파일이 300개인 스킨에 요청 300번이 필요해서 선택하지 않았습니다.
50개씩 올렸을 때 파일이 300개인 스킨의 업로드에 4.1초가 걸렸습니다.
```

## 이름으로 알 수 없는 뜻은 주석이 아니라 이름에 담습니다

메타 파일의 `production` 키는 대상 환경이 아니라 공개 여부이고, 파일의 키 이름은 바꿀 수 없는 경우입니다.

어긋난 코드입니다. 키의 뜻을 주석으로 적었습니다.

```ts
import * as z from "zod";

export const skinMetaSchema = z.object({
  displayName: z.string(),
  // 대상 환경이 아니라 공개 여부다.
  production: z.boolean(),
});
```

맞는 코드입니다. 파일을 읽는 자리에서 속성의 이름을 `isPublic` 으로 바꿉니다.

```ts
import * as z from "zod";

const skinMetaFileSchema = z.object({ displayName: z.string(), production: z.boolean() });

export const skinMetaSchema = skinMetaFileSchema.transform(({ displayName, production }) => ({
  displayName,
  isPublic: production,
}));
```
