import fs from "fs";

const mocksPath =
  "D:/_workspace/01_项目-Coding/A300-职业导航-career-nav/lib/mocks/report-mocks.ts";
const text = fs.readFileSync(mocksPath, "utf8");

function extractConst(name) {
  const re = new RegExp(`export const ${name}[^=]*= ([\\s\\S]*?);\\n`);
  const m = text.match(re);
  if (!m) throw new Error(`missing ${name}`);
  return Function(`"use strict"; return (${m[1]});`)();
}

const all = {
  overview: extractConst("MOCK_OVERVIEW"),
  strength: extractConst("MOCK_STRENGTH"),
  positioning: extractConst("MOCK_POSITIONING"),
  resumeDiagnosis: extractConst("MOCK_RESUME_DIAGNOSIS"),
  advice: extractConst("MOCK_ADVICE"),
  employmentIndex: 45,
};

fs.writeFileSync(
  "D:/_workspace/01_项目-Coding/HP102-职业导航智能体-career-nav-agent/tests/fixtures/report-mock.json",
  JSON.stringify(all, null, 2),
);
