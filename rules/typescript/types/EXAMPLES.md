# 타입 예시

## 추론되는 타입은 적지 않습니다

어긋난 코드입니다. 함수의 반환 타입과 변수의 타입을 적었습니다.

```ts
type PublishResult = { ok: true; fileCount: number; publishedAt: Date } | { ok: false; reason: string };
type SkinMeta = { displayName: string; tags: string[] };

export function describeResult(result: PublishResult): string {
  const label: string = result.ok ? `${result.fileCount}개 게시` : result.reason;
  return label;
}

export const meta: SkinMeta = { displayName: "가을 룩북", tags: ["가을"] };
```

맞는 코드입니다. 반환 타입과 변수의 타입은 TypeScript 가 추론합니다. 객체가 `SkinMeta` 에 맞는지는 `satisfies` 로 확인합니다.

```ts
type PublishResult = { ok: true; fileCount: number; publishedAt: Date } | { ok: false; reason: string };
type SkinMeta = { displayName: string; tags: string[] };

export function describeResult(result: PublishResult) {
  const label = result.ok ? `${result.fileCount}개 게시` : result.reason;
  return label;
}

export const meta = { displayName: "가을 룩북", tags: ["가을"] } satisfies SkinMeta;
```

## 함수가 돌려주는 값은 `return` 식에서 확인합니다

어긋난 코드입니다. 함수가 `PublishResultForLog` 를 돌려주는지 확인하려고 반환 타입을 적었습니다.

```ts
type PublishSuccess = { ok: true; fileCount: number; publishedAt: Date };
type PublishFailure = { ok: false; reason: string };
type PublishResultForLog = Omit<PublishSuccess, "publishedAt"> | PublishFailure;

export function toPublishResultForLog(result: PublishSuccess | PublishFailure): PublishResultForLog {
  if (!result.ok) {
    return { ok: result.ok, reason: result.reason };
  }
  return { ok: result.ok, fileCount: result.fileCount };
}
```

맞는 코드입니다. 반환 타입은 적지 않고 `return` 식에 `satisfies` 를 붙입니다.

```ts
type PublishSuccess = { ok: true; fileCount: number; publishedAt: Date };
type PublishFailure = { ok: false; reason: string };
type PublishResultForLog = Omit<PublishSuccess, "publishedAt"> | PublishFailure;

export function toPublishResultForLog(result: PublishSuccess | PublishFailure) {
  if (!result.ok) {
    return { ok: result.ok, reason: result.reason } satisfies PublishResultForLog;
  }
  return { ok: result.ok, fileCount: result.fileCount } satisfies PublishResultForLog;
}
```

## 유니온 타입에는 `Omit` 을 멤버마다 씁니다

어긋난 코드입니다. `Omit` 을 유니온에 직접 쓰면 모든 멤버에 있는 `ok` 만 남습니다. `fileCount` 와 `reason` 이 없는 값이 오류 없이 통과합니다.

```ts
type PublishSuccess = { ok: true; fileCount: number; publishedAt: Date };
type PublishFailure = { ok: false; reason: string };
type PublishResult = PublishSuccess | PublishFailure;

export type PublishResultForLog = Omit<PublishResult, "publishedAt">;

export const logged = { ok: true } satisfies PublishResultForLog;
```

맞는 코드입니다. `publishedAt` 이 있는 멤버에만 `Omit` 을 씁니다.

```ts
type PublishSuccess = { ok: true; fileCount: number; publishedAt: Date };
type PublishFailure = { ok: false; reason: string };

export type PublishResultForLog = Omit<PublishSuccess, "publishedAt"> | PublishFailure;

export const logged = { ok: true, fileCount: 12 } satisfies PublishResultForLog;
```

## 두 곳 이상에서 쓰는 객체 타입에는 이름을 붙입니다

어긋난 코드입니다. 구조가 같은 객체 타입을 두 함수의 인자 자리에 한 번씩 적었습니다.

```ts
export function describeSkin(skin: { name: string; fileCount: number }) {
  return `${skin.name} (${skin.fileCount}개)`;
}

export function isEmptySkin(skin: { name: string; fileCount: number }) {
  return skin.fileCount === 0;
}
```

맞는 코드입니다. 두 함수가 쓰는 타입에 이름을 붙여 한 번만 선언합니다. `describeUploader` 의 인자 타입은 이 함수 하나에서만 쓰므로 인자 자리에 직접 적었습니다.

```ts
type SkinSummary = { name: string; fileCount: number };

export function describeSkin(skin: SkinSummary) {
  return `${skin.name} (${skin.fileCount}개)`;
}

export function isEmptySkin(skin: SkinSummary) {
  return skin.fileCount === 0;
}

export function describeUploader(uploader: { email: string; uploadedSkinCount: number }) {
  return `${uploader.email} (${uploader.uploadedSkinCount}개)`;
}
```

## 값의 목록은 한 번만 적습니다

어긋난 코드입니다. 게시 상태 네 가지를 타입에 한 번, 라벨 표의 키에 한 번 적었습니다.

```ts
export type PublishStatus = "draft" | "validated" | "published" | "failed";

export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  draft: "초안",
  validated: "검사 통과",
  published: "게시됨",
  failed: "실패",
};
```

맞는 코드입니다. 라벨 표를 `as const` 로 한 번만 적고, 상태의 유니온 타입은 라벨 표의 키에서 만듭니다.

```ts
export const PUBLISH_STATUS_LABELS = {
  draft: "초안",
  validated: "검사 통과",
  published: "게시됨",
  failed: "실패",
} as const;

export type PublishStatus = keyof typeof PUBLISH_STATUS_LABELS;
```

## 실행 중에 읽지 않는 값의 목록은 만들지 않습니다

어긋난 코드입니다. `PUBLISH_STEPS` 를 실행 중에 읽는 코드가 없고, 타입을 만드는 데만 씁니다.

```ts
const PUBLISH_STEPS = ["validate", "upload", "invalidate-cache"] as const;

export type PublishStep = (typeof PUBLISH_STEPS)[number];
```

맞는 코드입니다. 리터럴 유니온 타입만 선언합니다.

```ts
export type PublishStep = "validate" | "upload" | "invalidate-cache";
```

## 테스트의 가짜 객체에도 타입 단언을 쓰지 않습니다

어긋난 코드입니다. 함수가 `env` 전체를 받기 때문에, 테스트가 가짜 객체를 타입 단언으로 `KVNamespace` 와 `R2Bucket` 인 것처럼 꾸몄습니다.

```ts
export async function invalidateGalleryCache(env: { ASSET_BUCKET: R2Bucket; GALLERY_KV: KVNamespace }) {
  await env.GALLERY_KV.delete("gallery:list");
}

const deletedKeys = new Set<string>();
const kv = { delete: async (key: string) => { deletedKeys.add(key); } } as unknown as KVNamespace;
const bucket = {} as unknown as R2Bucket;
export const run = invalidateGalleryCache({ ASSET_BUCKET: bucket, GALLERY_KV: kv });
```

맞는 코드입니다. 함수는 실제로 쓰는 `delete` 하나만 요구합니다. 테스트의 가짜 객체는 단언 없이 그 타입에 맞고, Workers 의 `env` 전체도 그대로 넘길 수 있습니다.

```ts
export async function invalidateGalleryCache(env: { GALLERY_KV: Pick<KVNamespace, "delete"> }) {
  await env.GALLERY_KV.delete("gallery:list");
}

const deletedKeys = new Set<string>();
export const run = invalidateGalleryCache({
  GALLERY_KV: {
    delete: async (key: string) => {
      deletedKeys.add(key);
    },
  },
});

declare const env: { ASSET_BUCKET: R2Bucket; GALLERY_KV: KVNamespace };
export const runWithRealEnv = invalidateGalleryCache(env);
```

## 원시 타입 하나로 적는 속성은 그대로 적습니다

어긋난 코드입니다. `keyword` 의 타입 `string` 을 `SkinMeta` 에서 가져왔고, `category` 의 리터럴 유니온은 다시 적었습니다.

```ts
type SkinMeta = { displayName: string; category: "패션" | "가전" | "가구" | "식품" };

export type SkinSearchQuery = {
  keyword: SkinMeta["displayName"];
  category: "패션" | "가전" | "가구" | "식품";
};
```

맞는 코드입니다. `keyword` 는 `string` 으로 적고, `category` 의 리터럴 유니온은 `SkinMeta` 에서 가져옵니다.

```ts
type SkinMeta = { displayName: string; category: "패션" | "가전" | "가구" | "식품" };

export type SkinSearchQuery = {
  keyword: string;
  category: SkinMeta["category"];
};
```
