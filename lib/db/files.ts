import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { DomainError } from "../errors";

export type ResumeFileExt = "pdf" | "docx";

function getResumeDir(): string {
  return process.env.RESUME_DIR ?? "./data/resumes";
}

export function saveResumeFile(
  userId: string,
  fileId: string,
  ext: string,
  buf: Buffer,
): string {
  if (ext !== "pdf" && ext !== "docx") {
    throw new DomainError("UNSUPPORTED_FILE");
  }

  const relativePath = `${userId}/${fileId}.${ext}`;
  const fullPath = join(getResumeDir(), relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, buf);
  return relativePath;
}
