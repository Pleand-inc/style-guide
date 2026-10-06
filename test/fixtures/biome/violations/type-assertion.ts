interface Shape {
  kind: string;
}

export const fromUnknown = (value: unknown) => value as Shape;
export const doubleAssertion = (value: number) => value as unknown as Shape;
export const widened = "literal" as string;
export const angleBracket = (value: unknown) => <Shape>value;
