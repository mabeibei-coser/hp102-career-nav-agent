export const REDLINE_WORDS = [
  "失业",
  "空白期",
  "断续就业",
  "再就业",
  "待业",
  "年龄优势",
  "年龄劣势",
  "上了年纪",
  "赶紧",
  "尽快",
  "把握时机",
  "抓紧",
  "机不可失",
  "竞争激烈",
  "选择有限",
  "机会不多",
  "错失",
  "内卷",
  "35岁危机",
  "35 岁危机",
  "中年危机",
  "MBTI",
  "大五",
  "霍兰德",
];

const REDLINE_PATTERNS = [/已经\s*\d+\s*岁/];

export function findRedlineWords(text: string): string[] {
  const hits: string[] = [];
  for (const word of REDLINE_WORDS) {
    if (text.includes(word)) hits.push(word);
  }
  for (const pat of REDLINE_PATTERNS) {
    const m = text.match(pat);
    if (m) hits.push(m[0]);
  }
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const h of hits) {
    if (!seen.has(h)) {
      seen.add(h);
      ordered.push(h);
    }
  }
  return ordered;
}
