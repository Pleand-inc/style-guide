import { readFileSync } from "node:fs";

export const firstArgument = () => process.argv[2] ?? "";
export const read = (path: string) => readFileSync(path, "utf8");
