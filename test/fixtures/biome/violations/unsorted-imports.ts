import { vi } from "vitest";
import { widget } from "@acme/widgets";

vi.mock("@acme/widgets");

export const build = () => widget();
