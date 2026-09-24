export function stripReasoning(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/g, "")
    .trim();
}

export function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const firstBrace = content.indexOf("{");
  const firstBracket = content.indexOf("[");
  let start = -1;
  if (firstBrace >= 0 && firstBracket >= 0) {
    start = Math.min(firstBrace, firstBracket);
  } else {
    start = Math.max(firstBrace, firstBracket);
  }
  if (start >= 0) {
    const sliced = content.slice(start).trim();
    const lastBrace = sliced.lastIndexOf("}");
    const lastBracket = sliced.lastIndexOf("]");
    const end = Math.max(lastBrace, lastBracket);
    return end >= 0 ? sliced.slice(0, end + 1) : sliced;
  }
  return content.trim();
}

export function tryFixAndParse(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr);
  } catch {
    let fixed = jsonStr;
    fixed = fixed.replace(/[\u201C\u201D]/g, '"');
    fixed = fixed.replace(/[\u2018\u2019]/g, "'");
    fixed = fixed.replace(/("(?:[^"\\]|\\.)*")\s*：/g, "$1:");
    fixed = fixed.replace(/，/g, ",");
    try {
      return JSON.parse(fixed);
    } catch {
      /* continue */
    }
    fixed = fixed.replace(/[\x00-\x1f]/g, " ");
    fixed = fixed.replace(/\\(?!["\\/bfnrtu])/g, "");
    fixed = fixed.replace(/,\s*([}\]])/g, "$1");
    fixed = fixed.replace(/}(\s*")/g, "},$1");
    fixed = fixed.replace(/](\s*")/g, "],$1");
    fixed = fixed.replace(/"(\s*\{)/g, '",$1');
    fixed = fixed.replace(/"(\s*\[)/g, '",$1');
    fixed = fixed.replace(/"(\s*\n\s*"(?:[^"]*":))/g, '",$1');
    fixed = fixed.replace(/(\d)(\s*\n\s*")/g, "$1,$2");
    try {
      return JSON.parse(fixed);
    } catch {
      /* continue */
    }
    const quoteCount = (fixed.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) fixed += '"';
    const opens = (fixed.match(/[{[]/g) || []).length;
    const closes = (fixed.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      const lastOpen =
        fixed.lastIndexOf("{") > fixed.lastIndexOf("[") ? "}" : "]";
      fixed += lastOpen;
    }
    return JSON.parse(fixed);
  }
}

export const JSON_ONLY_PREFIX = `【输出约束 · 必须严格遵守】
1. 只输出合法 JSON 对象，第一个字符必须是 {，最后一个字符必须是 }
2. 禁止任何说明性前言（如"让我分析..." "用户要求..." "好的，我来..."）
3. 禁止 markdown 代码围栏（\`\`\`json）
4. 禁止 JSON 之外的任何文字、注释、解释
5. 禁止思考过程被输出到 response 里
6. **严禁原样照抄 schema 模板里的占位符**——如 "..."、"<字段描述>"、"字符串"、"数字" 等示例值都是给你看的说明，你必须把它们**替换为真实内容**（参考具体字段要求）。任何字符串字段都不能是空串、不能是 "..."、不能是 "<...>"
7. 数组字段如果要求"至少 N 条"，必须填满 N 条真实内容，不能返回空数组或"..."

以下是章节具体要求：
`;
