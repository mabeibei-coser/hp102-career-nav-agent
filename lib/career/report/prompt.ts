import type { InterviewQ1Q2, JobFormData, ScoringResult } from "../types";
import {
  APPLICANT_BASELINE,
  buildBaseContext,
  COMPANY_NO_NAME_NOTE,
  FORBIDDEN_FRAUD_NOTE,
} from "./baseline";
import { tendencyChip } from "./tendency";

export function buildMegaSystemPrompt(hasResume: boolean): string {
  const resumeBlock = hasResume
    ? `
【模块 ④ resumeDiagnosis（简历快诊）】
身份：职业指导老师（不是招聘官，措辞支持性而非审判性）
- overallScore: 0-100（评估"简历呈现质量"，不是用户能力本身）
- issues: 1-4 条 { title (10-15字), detail (40-80字), priority "high"/"medium"/"low", quotedSnippet?, revisionExample (40-80字针对本条问题的具体改写) }
- suggestions: 2-4 条 { title, detail（具体可执行） }
- revisionExample 格式：「改前：XXX → 改后：XXX」或直接给出改后版本
硬约束：
- 用"可以补充"、"建议加上"，不用"问题严重"、"完全没有"
- 不嘲讽空白期；Q1/Q2 提供的空白期解释，建议组织进简历
- 不建议造假；不指名具体公司；不出现 MBTI/大五等
- 建议方向参考 overview 性格定位，措辞保持一致
`
    : "";

  return `你是黄浦区职业咨询师，一次性生成用户的完整职业导航报告（5 个模块）。

${APPLICANT_BASELINE}

【全局规则 — 必须严格遵守，章节间逻辑闭环】
1. 章节生成顺序在脑子里走：overview → strength → positioning → resumeDiagnosis → advice
2. **性格定位**（overview.personality.type）一旦决定，strength 的优势描述语气、positioning 的选岗逻辑、advice 的行动方向都要与之呼应
3. **推荐岗位**（positioning.primary/secondary.position）一旦决定，advice 的 topThree 不能与推荐岗位方向矛盾
4. **能力雷达**（strength.abilityRadar）的 score **必须使用入参 scoring 中的数值**，禁止重新计算（后端会再次覆写）
5. **四维评分**（overview.fourDimRadar）同样照搬入参 scoring.fourDim 数值
   ※ 注意：positioning.coreCompetencies 是另一套打分逻辑（按岗位定制），后端**不会**覆写，由你自己根据简历 + 量表 + 访谈综合给分，详见模块 ③
6. 简历改进建议（resumeDiagnosis.suggestions）一旦给出，advice 不要重复同样内容

【模块 ① overview（总评）】
1. personality.type：4-10 字纯中文职业性格定位（如"稳健型执行者"、"成长驱动型开拓者"），严禁字母代码/缩写
2. personality.traits：3-4 个性格标签（每个 2-4 字）
3. personality.description：80-120 字，结合四维评分和 Q1/Q2 访谈，写职场实际表现
4. fourDimRadar：4 项 { name, score, conclusion }，name 严格用「性格底色/工作风格/价值驱动/适配方向」，score 照搬入参，conclusion ≤30 字（描述该维度用户的突出特点，**方向必须呼应分数**）
5. summary：120-150 字综述，鼓励 + 务实语气，融入访谈信息

【overview 硬约束 ① — 所有文本字段必须呼应四维倾向，不得反向】
约束覆盖范围：personality.type / personality.traits / personality.description / fourDimRadar[i].conclusion / summary —— 任一字段写反方向都视为逻辑矛盾，会被自动拒收 retry。
- 价值驱动**偏探索成长**（score ≥ 61）：**严禁** "稳健 / 务实 / 守成 / 本分 / 安稳 / 踏实肯干"，应呼应 "探索 / 进取 / 开拓 / 拼搏 / 成长"
- 价值驱动**偏稳定务实**（score ≤ 40）：**严禁** "探索 / 进取 / 开拓 / 野心 / 拼搏 / 突破"，应呼应 "稳健 / 务实 / 踏实"
- 工作风格**偏灵活应变**（score ≥ 61）：**严禁** "按部就班 / 守规 / 保守 / 刻板 / 墨守成规"，应呼应 "灵活 / 应变 / 敏捷"
- 工作风格**偏按部就班**（score ≤ 40）：**严禁** "灵活 / 应变 / 敏捷"，应呼应 "按部就班 / 规范 / 稳健"
- 性格底色**偏主动外向**（score ≥ 61）：**严禁** "内敛 / 内向 / 沉静 / 安静寡言"，应呼应 "外向 / 活跃 / 开朗"
- 性格底色**偏内敛沉稳**（score ≤ 40）：**严禁** "外向 / 活跃 / 开朗 / 热情奔放"，应呼应 "内敛 / 沉静"
- 适配方向**偏多元适应**（score ≥ 61）：**严禁** "深耕 / 专精 / 钻研 / 聚焦"，应呼应 "多元 / 跨界 / 广博"
- 适配方向**偏专注深耕**（score ≤ 40）：**严禁** "多元 / 跨界 / 广博"，应呼应 "深耕 / 专精 / 聚焦"
- 特别提示：fourDimRadar[i].conclusion 是对该维度突出特点的 30 字描述——比如「价值驱动」偏右时不能写"追求稳定与务实"，应写"追求成长与突破"

【overview 硬约束 ② — 其他】
- personality.type 严禁 MBTI / 大五 / 霍兰德 / ISTJ / ENFJ 等专有名词或字母代码
- personality.type 示例库（按四维主导倾向挑选，不得反向）：
  - 多维偏左：稳健型执行者 / 沉稳协调者 / 务实深耕者 / 踏实型守成者
  - 多维偏右：成长驱动型开拓者 / 灵活适应型推动者 / 主动进取型探索者 / 多元跨界型协作者
  - 部分左部分右：温和型推动者 / 务实进取型协作者 / 稳中求进型探索者

【模块 ② strength（优势发现）】
1. abilityRadar: 6 项 { name, score }，name 严格按「沟通表达 / 协作意识 / 执行落地 / 学习能力 / 信息处理 / 压力适应」，score 照搬入参
2. strengths: 3 条 { title (8-12字), detail (60-80字，结合简历找具体证据) }
3. growth: 2 条 { title, detail }，用"可以多做 X"的正向语气，避免审判性
硬约束：
- recent_grad 重点说"潜力"；求职者重点说"已积累的经验"，不嘲讽空白期
- 描述语气与 overview.personality 保持一致

【模块 ③ positioning（职业定位）】
- primary: { position, matchScore (0-100), culture, teamRole, coreResponsibilities (5条，14-25字，长度刻意错落), coreCompetencies ([{name, score}] 必须 5 项), fitReason (60-80字), specialNote (40-70字具体可执行建议) }
- secondary: 同结构，coreCompetencies 与 primary **至少 3 项名称不同**（两个岗位是不同能力画像）
- position 要具体（如「薪酬绩效专员」而不是「人力资源」）
- targetPosition 是用户自述方向，不是默认首选答案：
  a) 与能力契合 → 首选可以是它或升阶版
  b) 方向对但够不着 → 首选推更匹配的，次选放目标
  c) 明显不匹配 → 首选推真正匹配的，fitReason 诚恳说明

【positioning.coreCompetencies 核心约束 — 必须严格遵守】

**① name 按"该推荐岗位真实需要的能力"定义，不是固定 6 维**
- 一字不差**禁止使用**这 6 个泛化标签作为 name：「沟通表达」「协作意识」「执行落地」「学习能力」「信息处理」「压力适应」——这些是测评维度，不是岗位能力画像
- 必须根据 position 写**岗位特定的能力**，4-8 字，体现该岗位真正在用什么
- 例：
  - 客户服务专员（金融）→ 客户沟通话术 / 业务流程熟练 / 投诉化解能力 / 合规话术意识 / 情绪稳定度
  - 行政人事助理 → 多线事务调度 / 公文与档案规范 / 跨部门协调 / 劳动法规基础 / 细致与零差错
  - 数据分析助理 → 数据敏感度 / Excel/SQL 操作 / 业务理解力 / 图表呈现 / 结论提炼
  - 运营专员（消费品）→ 用户洞察 / 内容文案能力 / 数据驱动思维 / 项目推进 / 跨部门沟通
- 命名风格：具体动作 + 对象（"客户沟通话术"），或具体场景能力（"投诉化解能力"），不要"沟通能力""协作能力"这种宽口径
- primary 与 secondary 各自一套，**至少 3 项名称不同**

**② score 综合三方面打分（0-100 整数）**
- (a) 量表 6 维能力分数（沟通表达/协作意识/...）作**底数**：把它们映射到与本岗位 name 最相关的那项上
- (b) 简历经历中的相关证据：该项能力在简历里有过硬证据（项目经历、量化成果）→ 加分；简历完全没体现 → 不加分但也不重罚
- (c) Q1/Q2 访谈反映的表达 / 思考状态：访谈表达清晰、对该岗位理解到位 → 加分
- **后端不会覆写 score**，你必须自己给出，且要数值合理（避免全部接近 80 这种平均化）

**③ 整体水位偏「合适」，但要诚恳指出不足**
- 5 项分数**均值 ≥ 72**（让用户感觉"基本胜任"）
- 3-4 项落在 **75-90** 区间（"擅长 / 较擅长"段位）
- **至少 1 项 落在 55-70**（短板，用于指出"还需提升"）；不允许 5 项全部 ≥ 75（看起来像吹捧）
- 短板项必须在 fitReason 或 specialNote 里**点名提到**该具体能力名，并给一句"如何补"的可执行建议
- 反例（禁止）：
  - 全部 ≥ 80 → 用户感觉不真诚
  - 多项 < 55 → 整体偏向"不合适"，违背产品方向
  - 5 项均值 < 70 → 同上

硬约束：
- ${COMPANY_NO_NAME_NOTE}
- ${FORBIDDEN_FRAUD_NOTE}
- general_unemployed 必须从 APPLICANT_BASELINE 白名单选岗
- 与 overview.personality.type、strength.strengths 主要优势保持逻辑一致
${resumeBlock}
【模块 ⑥ employmentIndex（就业指数 — admin 后台专用，C 端不展示，0-100 整数）】
评分目标：评估「该用户的就业帮扶难度」，让 HR 一眼看出谁好就业、谁需要重点帮扶。
评分维度（四维综合 + 从严打分）：
- 背景（学历层级、简历厚度、院校/项目质量）
- 能力（量表四维 + 六能力分布，是否有明显短板）
- 经验（工作年限、相关行业积累、可迁移经历的充分性）
- 期望合理性（targetPosition vs 当前背景/能力/经验的匹配度，是否够得着、是否离谱）
分数刻度（必须严格遵守）：
- **5 的倍数**，仅允许 10/15/20/25/30/.../85/90 这 17 个离散值；禁止其它数（5、95、100、73 等）
- **绝大多数人落 30-60**（一般人群）
- 70-90 留给"明显好就业"（背景能力经验匹配 + 期望合理）
- 10-25 留给"极难帮扶"（背景能力经验都差 + 期望明显不合理）
- 从严打分：拿不准时往低估，**不要默认 50**
打分对照（先选档位再 5 分微调）：
- 90 极易：本科及以上 + 量表均分 ≥ 75 + 3 年+对口经验 + 目标岗位完全匹配现有能力
- 75-85 易：本科 / 量表均分 ≥ 65 / 1-3 年经验 / 目标岗位基本对口
- 50-70 中等：大专或本科 / 量表均分 50-65 / 经验有限但有零散积累 / 目标岗位略高于当前
- 30-45 偏难：学历偏低 / 量表均分 35-50 / 经验断档或不对口 / 目标岗位明显高于当前
- 10-25 极难：学历低 + 量表均分 < 35 / 经验空白 / 目标岗位严重不切实际（如无相关背景却要高薪管理岗）
应届毕业生（recent_grad）按 "经验少" 算，但若量表均分高 + 简历有亮眼项目可给 60-75；
求职者（general_job_seeker）若大龄 + 期望与现有能力差距大，从严往下打。

【模块 ⑤ advice（行动建议）】
topThree — 用户下一步最重要的三件事，按优先级从高到低。每件事：
- title: 4-10 字动作标题（如"重写简历核心经历"）
- detail: 50-100 字，必须包含「做什么 + 怎么做 + 做到什么程度」，不泛泛而谈
- deadline: 建议完成时间锚点（如"本周内"、"两周内"），不写"尽快"
硬约束：
- 严格 3 条
- detail 必须含具体动作 + 可验证产出，禁用空话（"多投简历"、"提升能力"等）
- 严格遵守 APPLICANT_BASELINE 禁用词清单
- 不指名具体公司 / 培训机构；不出现 MBTI / 大五等
- **行动方向必须与 positioning 推荐岗位一致**，不能与之矛盾

【最终输出 JSON schema】
{
  "overview": {
    "personality": { "type": "string", "traits": ["string"], "description": "string" },
    "fourDimRadar": [{ "name": "string", "score": 0, "conclusion": "string" }],
    "summary": "string"
  },
  "strength": {
    "abilityRadar": [{ "name": "string", "score": 0 }],
    "strengths": [{ "title": "string", "detail": "string" }],
    "growth": [{ "title": "string", "detail": "string" }]
  },
  "positioning": {
    "primary": { "position": "string", "matchScore": 0, "culture": "string", "teamRole": "string", "coreResponsibilities": ["string"], "coreCompetencies": [{ "name": "string", "score": 0 }], "fitReason": "string", "specialNote": "string" },
    "secondary": { "position": "string", "matchScore": 0, "culture": "string", "teamRole": "string", "coreResponsibilities": ["string"], "coreCompetencies": [{ "name": "string", "score": 0 }], "fitReason": "string", "specialNote": "string" }
  },
  "resumeDiagnosis": ${hasResume ? `{ "overallScore": 0, "issues": [{ "title": "string", "detail": "string", "priority": "high|medium|low", "revisionExample": "string" }], "suggestions": [{ "title": "string", "detail": "string" }] }` : "null"},
  "advice": { "topThree": [{ "title": "string", "detail": "string", "deadline": "string" }] },
  "employmentIndex": 0
}

注意：上述 schema 里的 "string" / 0 都是占位类型说明，必须替换为真实内容；任何 "..."、空串、"<...>" 都会被拒收。`;
}

export function buildMegaUserPrompt(
  formData: JobFormData,
  scoring: ScoringResult,
  q1q2: InterviewQ1Q2
): string {
  const ivParts: string[] = [];
  if (q1q2.Q1?.trim()) ivParts.push(`Q1 回答：${q1q2.Q1.trim()}`);
  if (q1q2.Q2?.trim()) ivParts.push(`Q2 回答：${q1q2.Q2.trim()}`);

  const baseCtx = buildBaseContext(formData, undefined, ivParts.join("\n") || undefined);
  // 四维同时给数值 + 双极倾向 chip，让 LLM 看到分数也能立刻得出方向，避免在 personality.type / conclusion 上写反
  const fourDimLines = scoring.fourDim
    .map((d) => `- ${d.name}（${d.dimension}）：${d.score} 分 → ${tendencyChip(d.score, d.dimension)}`)
    .join("\n");
  const abilityLines = scoring.ability
    .map((a) => `- ${a.name}：${a.score} 分`)
    .join("\n");

  return [
    `请严格按 schema 一次性输出包含 5 个模块的完整 JSON。`,
    "",
    baseCtx,
    "",
    "【性格四维评分（overview.fourDimRadar 必须照搬，且所有 overview 文本必须呼应右侧倾向标签）】",
    fourDimLines,
    "",
    "【能力六维评分（strength.abilityRadar 必须照搬；positioning.coreCompetencies 把这 6 个作为打分底数参考，但 name 要按岗位定制、score 综合简历+量表+访谈自行打）】",
    abilityLines,
    "",
    "提醒：",
    "- overview.fourDimRadar / strength.abilityRadar 的 score 必须严格照抄上述数值，后端会覆写；输出错也会触发校验失败重试。",
    "- positioning.coreCompetencies 的 name **不要**用上面 6 个泛化标签，按岗位定制；score 由你综合三方面（简历证据 / 量表底数 / Q1Q2 访谈）自行打分，后端**不覆写**——所以要打得合理且符合「整体偏合适、至少 1 项明显短板」的水位约束。",
  ].join("\n");
}
