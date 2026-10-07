import { vi } from "vitest";

vi.mock("./widget");
vi.doMock("../widget");
vi.unmock("./widget");
vi.doUnmock("../widget");
vi.mock("./factory", () => ({
  widget: vi.fn(),
}));

export const actual = () => vi.importActual<unknown>("./widget");
export const mocked = () => vi.importMock("../widget");
