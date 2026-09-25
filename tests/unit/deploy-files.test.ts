import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("deploy files", () => {
  it("ecosystem.config.js has single fork instance", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require("../../ecosystem.config.js");
    const app = config.apps[0];
    expect(app.instances).toBe(1);
    expect(app.exec_mode).toBe("fork");
  });

  it("env.production.example has correct values", () => {
    const content = readFileSync(
      join(__dirname, "../../deploy/env.production.example"),
      "utf-8",
    );
    expect(content).toContain("NEXT_PUBLIC_BASE_PATH=/hp102");
    expect(content).toContain(
      "BANANAROUTER_BASE_URL=https://api.bananarouter.com",
    );
    expect(content).toContain("BANANAROUTER_MODEL=gemini-3.1-flash-lite");
    expect(content).toContain("BANANAROUTER_API_KEY=");
    expect(content).not.toContain("E2E_MOCK_MODE=true");
    expect(content).not.toContain("IFLYTEK");
  });

  it("nginx.conf.example has correct location and body size", () => {
    const content = readFileSync(
      join(__dirname, "../../deploy/nginx.conf.example"),
      "utf-8",
    );
    expect(content).toContain("location /hp102");
    expect(content).toContain("client_max_body_size 10m");
  });
});
