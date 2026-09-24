import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const EXPECTED_DEPS = [
  "better-sqlite3",
  "clsx",
  "iron-session",
  "lucide-react",
  "mammoth",
  "next",
  "pdf-parse",
  "react",
  "react-dom",
  "tailwind-merge",
  "zod",
];

const EXPECTED_DEV_DEPS = [
  "@playwright/test",
  "@tailwindcss/postcss",
  "@types/better-sqlite3",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "docx",
  "eslint",
  "eslint-config-next",
  "tailwindcss",
  "tsx",
  "typescript",
  "vitest",
];

describe("config", () => {
  const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (originalBasePath === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
    }
    vi.resetModules();
  });

  it("uses basePath and assetPrefix when NEXT_PUBLIC_BASE_PATH is set", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/hp102";
    vi.resetModules();
    const { default: config } = await import("../../next.config");
    expect(config.basePath).toBe("/hp102");
    expect(config.assetPrefix).toBe("/hp102");
  });

  it("uses empty basePath when NEXT_PUBLIC_BASE_PATH is unset", async () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.resetModules();
    const { default: config } = await import("../../next.config");
    expect(config.basePath).toBe("");
    expect(config.assetPrefix).toBe("");
  });

  it("has correct serverExternalPackages and package.json dependencies", async () => {
    const { default: config } = await import("../../next.config");
    expect(config.serverExternalPackages).toContain("better-sqlite3");
    expect(config.serverExternalPackages).toContain("pdf-parse");
    expect(config.serverExternalPackages).toContain("mammoth");

    const pkg = JSON.parse(
      readFileSync(join(__dirname, "../../package.json"), "utf-8"),
    );
    expect(Object.keys(pkg.dependencies).sort()).toEqual(EXPECTED_DEPS.sort());
    expect(Object.keys(pkg.devDependencies).sort()).toEqual(
      EXPECTED_DEV_DEPS.sort(),
    );
  });
});
