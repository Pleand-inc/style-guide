# 이름과 함수 예시

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
