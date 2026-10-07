# 외부 입력 예시

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
