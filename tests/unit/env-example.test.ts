import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const EXPECTED_VARS = [
  "NEXT_PUBLIC_BASE_PATH",
  "SESSION_SECRET",
  "DB_PATH",
  "RESUME_DIR",
  "BANANAROUTER_API_KEY",
  "BANANAROUTER_BASE_URL",
  "BANANAROUTER_MODEL",
  "E2E_MOCK_MODE",
];

function parseEnvExample(content: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const name = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    vars.set(name, value);
  }
  return vars;
}

describe(".env.example", () => {
  const content = readFileSync(
    join(__dirname, "../../.env.example"),
    "utf-8",
  );
  const vars = parseEnvExample(content);

  it("has exactly the expected variable names", () => {
    expect(new Set(vars.keys())).toEqual(new Set(EXPECTED_VARS));
  });

  it("has correct BananaRouter defaults", () => {
    expect(vars.get("BANANAROUTER_BASE_URL")).toBe(
      "https://api.bananarouter.com",
    );
    expect(vars.get("BANANAROUTER_MODEL")).toBe("gemini-3.1-flash-lite");
  });

  it("leaves secrets empty", () => {
    expect(vars.get("BANANAROUTER_API_KEY")).toBe("");
    expect(vars.get("SESSION_SECRET")).toBe("");
  });
});
