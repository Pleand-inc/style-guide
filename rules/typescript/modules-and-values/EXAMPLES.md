# 모듈과 값 예시

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
