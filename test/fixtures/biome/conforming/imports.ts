import "@acme/widgets/styles.css";
import "chart.js";
import { widget } from "@acme/widgets";
import widgetData from "@acme/widgets/data.json";
import type { WidgetOptions } from "@acme/widgets/options";
import widgetSource from "@acme/widgets/source.ts?raw";
import { vi } from "vitest";

vi.mock("@acme/widgets");

export const defaultWidgetData = widgetData;

export const widgetSourceText = widgetSource;

export type Widget = import("@acme/widgets").Widget;

export const build = (options: WidgetOptions) => widget(options);

export const loadWidgets = () => import("@acme/widgets");

export const loadByName = (name: string) => import(name);

export const loadWidgetPage = (name: string) =>
  import(`@acme/widgets/pages/${name}`);

export const loadWidgetData = () =>
  import("@acme/widgets/data.json", { with: { type: "json" } });

export const actualWidgets = () =>
  vi.importActual<typeof import("@acme/widgets")>("@acme/widgets");

export const iconUrl = new URL("https://example.com/a.png", import.meta.url);

export const widgetModules = import.meta.glob("@acme/widgets/*.ts");
