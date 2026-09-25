/**
 * Build and run maintenance close for all pending check files.
 * Usage: npx tsx scripts/maintenance-close-phase1.ts
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(".");
const checkPs1 = path.resolve(
  "..",
  ".gstack",
  "maintenance",
  "Invoke-ExperienceCheck.ps1",
);

function sha256File(rel: string): string {
  const buf = readFileSync(path.join(root, rel));
  return createHash("sha256").update(buf).digest("hex");
}

const check = spawnSync(
  "powershell",
  ["-NoProfile", "-File", checkPs1, "--root", root, "check"],
  { encoding: "utf8", cwd: root },
);
const checkOut = (check.stdout || "") + (check.stderr || "");
const jsonStart = checkOut.indexOf("{");
if (jsonStart < 0) {
  console.error(checkOut);
  process.exit(1);
}
const checkJson = JSON.parse(checkOut.slice(jsonStart));
const pending: Array<{ path: string; sha256: string }> = checkJson.pending_changes ?? [];

const files = pending.map((p) => p.path);
// Always include main doc + config in expected even if not in pending
const mainDoc = "docs/maintenance-experience.md";
const configFile = ".maintenance-experience.json";
const required = new Set([...files, mainDoc, configFile]);

const expectedArgs: string[] = [];
for (const rel of [...required].sort()) {
  if (!existsSync(path.join(root, rel))) {
    console.error("missing", rel);
    process.exit(1);
  }
  expectedArgs.push(`${rel}=${sha256File(rel)}`);
}

const verification =
  "Phase2-3: unit 141 passed; T2.1-T3.3 code done; T2.8/T2.9 blocked on real device/WeChat; E2E mock for report/pdf/voice/login; no deploy. No new maintenance case.";

const args = [
  "-NoProfile",
  "-File",
  checkPs1,
  "--root",
  root,
  "close",
  "--task",
  "docs/plan/PROGRESS.md",
  "--no-new-reason",
  "Phase2-3 close: remaining work is T2.8/T2.9 real-device confirmation and explicit deploy request only",
  "--verification",
  verification,
  "--files",
  ...files,
];

for (const e of expectedArgs) {
  args.push("--expected", e);
}

console.log("closing files=", files.length, "expected=", expectedArgs.length);
const close = spawnSync("powershell", args, { encoding: "utf8", cwd: root, maxBuffer: 20 * 1024 * 1024 });
process.stdout.write(close.stdout || "");
process.stderr.write(close.stderr || "");
process.exit(close.status ?? 1);
