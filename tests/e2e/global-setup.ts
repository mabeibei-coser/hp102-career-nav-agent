import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { makeResumeDocx } from "../fixtures/make-resume-docx";

const ROOT = path.resolve(__dirname, "../..");

export default async function globalSetup() {
  const dataDir = path.join(ROOT, "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  for (const target of [
    path.join(dataDir, "e2e.db"),
    path.join(dataDir, "e2e.db-shm"),
    path.join(dataDir, "e2e.db-wal"),
    path.join(dataDir, "e2e-resumes"),
    path.join(dataDir, "e2e-fail.db"),
    path.join(dataDir, "e2e-fail.db-shm"),
    path.join(dataDir, "e2e-fail.db-wal"),
    path.join(dataDir, "e2e-fail-resumes"),
  ]) {
    try {
      rmSync(target, { recursive: true, force: true });
    } catch {
      // A stale dev server may still hold the db; webServer will reuse or recreate.
    }
  }

  const fixtureDir = path.join(ROOT, "tests/fixtures");
  if (!existsSync(fixtureDir)) {
    mkdirSync(fixtureDir, { recursive: true });
  }

  const resumePath = path.join(fixtureDir, ".tmp-resume.docx");
  const buf = await makeResumeDocx();
  writeFileSync(resumePath, buf);
}
