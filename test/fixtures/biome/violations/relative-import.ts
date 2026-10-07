import current from ".";
import parent from "..";
import { grandparent } from "../../grandparent";
import { sibling } from "./sibling";
import type { OnlyType } from "../types";

export { reexported } from "./reexported";
export * from "../star";

export const dynamic = () => import("./dynamic");

export const uses: OnlyType[] = [current, parent, grandparent, sibling];
