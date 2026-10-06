# 코드 규칙 예시

규칙마다 규칙에 어긋난 코드와 규칙에 맞는 코드를 한 쌍씩 둡니다. 여기 있는 코드는 모두 이 저장소의 TypeScript 로 컴파일되는 코드입니다. 어긋난 코드는 컴파일은 되지만 규칙을 어깁니다.

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

## 받은 값을 그대로 돌려주는 함수는 만들지 않습니다

어긋난 코드입니다. 값 네 개를 객체 하나로 묶어 인자의 수만 줄였습니다. 함수는 받은 값을 그대로 돌려줍니다.

```ts
type PublishRequest = { skinName: string; isPublic: boolean; requesterEmail: string; includesPreviewPack: boolean };

export function createPublishRequest(fields: PublishRequest) {
  return { ...fields };
}

export const request = createPublishRequest({
  skinName: "autumn-lookbook",
  isPublic: false,
  requesterEmail: "admin@example.com",
  includesPreviewPack: true,
});
```

맞는 코드입니다. 값이 필요한 자리에 객체를 직접 적습니다. 다른 모듈이 요청 객체를 직접 적을 수 있게 `PublishRequest` 타입을 내보냅니다.

```ts
export type PublishRequest = { skinName: string; isPublic: boolean; requesterEmail: string; includesPreviewPack: boolean };

export const request = {
  skinName: "autumn-lookbook",
  isPublic: false,
  requesterEmail: "admin@example.com",
  includesPreviewPack: true,
} satisfies PublishRequest;
```

## 모듈은 패키지 이름으로 시작하는 경로로 가져옵니다

`apps/web/workers/handler.ts` 가 같은 앱의 `app/` 아래 파일을 가져오는 경우입니다.

어긋난 코드입니다. 상대 경로로 가져왔습니다.

```ts
import { isCompanyEmail } from "../app/features/account/domain/identity";

export function describeCaller(email: string) {
  return isCompanyEmail(email) ? "사내 계정" : "외부 계정";
}
```

맞는 코드입니다. `@acme/web/` 뒤에 `apps/web/` 폴더 안의 경로를 적습니다.

```ts
import { isCompanyEmail } from "@acme/web/app/features/account/domain/identity";

export function describeCaller(email: string) {
  return isCompanyEmail(email) ? "사내 계정" : "외부 계정";
}
```

## 삼항 연산자 안에 삼항 연산자를 쓰지 않습니다

어긋난 코드입니다. 조건 세 개를 삼항 연산자 안의 삼항 연산자로 이어 썼습니다.

```ts
type PublishProgress = { hasErrors: boolean; isPublished: boolean; isValidated: boolean };

export function describePublishProgress(progress: PublishProgress) {
  return progress.hasErrors ? "실패" : progress.isPublished ? "게시됨" : progress.isValidated ? "검사 통과" : "초안";
}
```

맞는 코드입니다. 조건마다 `if` 문 안에서 바로 `return` 합니다. 두 값 가운데 하나를 고르는 자리에는 삼항 연산자를 씁니다.

```ts
type PublishProgress = { hasErrors: boolean; isPublished: boolean; isValidated: boolean };

export function describePublishProgress(progress: PublishProgress) {
  if (progress.hasErrors) {
    return "실패";
  }
  if (progress.isPublished) {
    return "게시됨";
  }
  if (progress.isValidated) {
    return "검사 통과";
  }
  return "초안";
}

export function describeVisibility(isPublic: boolean) {
  return isPublic ? "공개" : "비공개";
}
```

## 반복문 안에서 스프레드로 값을 누적하지 않습니다

어긋난 코드입니다. 반복할 때마다 `Map` 전체를 스프레드로 다시 만듭니다.

```ts
type Skin = { name: string; category: "패션" | "가전" | "가구" | "식품" };

export function countSkinsByCategory(skins: Skin[]) {
  let counts = new Map<Skin["category"], number>();
  for (const skin of skins) {
    counts = new Map<Skin["category"], number>([...counts, [skin.category, (counts.get(skin.category) ?? 0) + 1]]);
  }
  return counts;
}
```

맞는 코드입니다. 키로 값을 찾는 누적이므로 `Map` 의 `set` 을 씁니다.

```ts
type Skin = { name: string; category: "패션" | "가전" | "가구" | "식품" };

export function countSkinsByCategory(skins: Skin[]) {
  const counts = new Map<Skin["category"], number>();
  for (const skin of skins) {
    counts.set(skin.category, (counts.get(skin.category) ?? 0) + 1);
  }
  return counts;
}
```

## 덮어써도 되는 속성이 정해져 있으면 스프레드를 쓰지 않습니다

어긋난 코드입니다. `patch` 의 타입은 `displayName` 과 `tags` 만 선언하지만, `ownerEmail` 이 들어 있는 값도 TypeScript 가 오류 없이 받습니다. 스프레드가 `ownerEmail` 을 덮어씁니다.

```ts
type SkinMeta = { displayName: string; ownerEmail: string; tags: string[] };
type SkinMetaPatch = Partial<Pick<SkinMeta, "displayName" | "tags">>;

export function applySkinMetaPatch(meta: SkinMeta, patch: SkinMetaPatch) {
  return { ...meta, ...patch };
}

const patchFromRequest = { displayName: "겨울 룩북", ownerEmail: "other@example.com" };
const meta = { displayName: "가을 룩북", ownerEmail: "admin@example.com", tags: ["가을"] };
export const patched = applySkinMetaPatch(meta, patchFromRequest);
```

맞는 코드입니다. 덮어쓸 속성의 이름을 하나씩 적습니다. 돌려주는 객체가 `SkinMeta` 에 맞는지는 `return` 식의 `satisfies` 로 확인합니다.

```ts
type SkinMeta = { displayName: string; ownerEmail: string; tags: string[] };
type SkinMetaPatch = Partial<Pick<SkinMeta, "displayName" | "tags">>;

export function applySkinMetaPatch(meta: SkinMeta, patch: SkinMetaPatch) {
  return {
    displayName: patch.displayName ?? meta.displayName,
    ownerEmail: meta.ownerEmail,
    tags: patch.tags ?? meta.tags,
  } satisfies SkinMeta;
}
```

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

## 프로그램 밖에서 들어온 값은 zod 로 검증합니다

어긋난 코드입니다. `JSON.parse` 의 결과를 검증하지 않고 타입 단언으로 `SkinMeta` 라고 적었습니다.

```ts
type SkinMeta = { displayName: string; category: "패션" | "가전" | "가구" | "식품"; tags: string[] };

export function parseSkinMeta(json: string) {
  return JSON.parse(json) as SkinMeta;
}
```

맞는 코드입니다. zod 스키마로 검증하고, `SkinMeta` 타입은 스키마에서 얻습니다.

```ts
import * as z from "zod";

const skinMetaSchema = z.object({
  displayName: z.string(),
  category: z.enum(["패션", "가전", "가구", "식품"]),
  tags: z.array(z.string()),
});

export type SkinMeta = z.infer<typeof skinMetaSchema>;

export function parseSkinMeta(json: string) {
  return skinMetaSchema.parse(JSON.parse(json));
}
```

## 변환이 붙은 스키마의 타입은 `z.infer` 와 `z.input` 으로 얻습니다

어긋난 코드입니다. 변환하기 전의 타입을 직접 선언했습니다. 스키마와 같은 구조를 두 번 적었습니다.

```ts
import * as z from "zod";

const skinMetaFileSchema = z.object({ displayName: z.string(), production: z.boolean() });

export const skinMetaSchema = skinMetaFileSchema.transform(({ displayName, production }) => ({
  displayName,
  isPublic: production,
}));

export type SkinMeta = z.infer<typeof skinMetaSchema>;
export type SkinMetaFile = { displayName: string; production: boolean };
```

맞는 코드입니다. `z.infer` 로 얻은 `SkinMeta` 는 변환한 뒤의 타입이라 `isPublic` 속성이 있습니다. `z.input` 으로 얻은 `SkinMetaFile` 은 변환하기 전의 타입이라 `production` 속성이 있습니다.

```ts
import * as z from "zod";

const skinMetaFileSchema = z.object({ displayName: z.string(), production: z.boolean() });

export const skinMetaSchema = skinMetaFileSchema.transform(({ displayName, production }) => ({
  displayName,
  isPublic: production,
}));

export type SkinMeta = z.infer<typeof skinMetaSchema>;
export type SkinMetaFile = z.input<typeof skinMetaSchema>;

export const meta = { displayName: "가을 룩북", isPublic: true } satisfies SkinMeta;
export const metaFile = { displayName: "가을 룩북", production: true } satisfies SkinMetaFile;
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
