interface Options {
  label?: string;
}

export type { Options };

export const withLabel = { label: "name" } satisfies Options;
export const withoutLabel = {} satisfies Options;

export const firstOrEmpty = (values: string[]) => values[0] ?? "";

export const colors = ["red", "blue"] as const;
export type Color = (typeof colors)[number];

export const lengthOf = (value: string | undefined) => value?.length ?? 0;
