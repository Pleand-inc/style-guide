export const pages = import.meta.glob("./pages/*.ts");
export const eagerPages = import.meta.glob("../pages/*.ts", { eager: true });
export const pageSets = import.meta.glob(["./pages/*.ts", "!./pages/draft.ts"]);
