import fs from "fs";
import path from "path";

let cached: string | null = null;

export function loadSkillBody(): string {
  if (cached) return cached;
  const filePath = path.join(
    process.cwd(),
    "lib/agent/skill/career-navigation.md",
  );
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  cached = (match?.[1] ?? raw).trim();
  return cached;
}
