# 주석 예시

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
