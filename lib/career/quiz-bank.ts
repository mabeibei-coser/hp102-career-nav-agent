import type { QuizQuestion } from "./types";

export const QUIZ_BANK_VERSION = "hp102-v1";

const SJT_01: QuizQuestion = {
  id: "SJT-01",
  dimension: "workstyle",
  text: "你被临时分配了一项完全陌生的任务，截止日期是三天后，没有人能现场指导你。你通常会怎么做？",
  options: [
    {
      label: "A",
      text: "立刻动手搜资料，边做边摸索，有不懂的就查，不等别人来告诉我怎么做",
      poleValue: 22,
      weights: { learning: 1.0, execution: 0.6 },
    },
    {
      label: "B",
      text: "先花半天把任务拆成若干小步骤，把每步要做什么列清楚，再一步步推进",
      poleValue: 35,
      weights: { execution: 1.0, data: 0.6 },
    },
    {
      label: "C",
      text: "找组里最熟悉这类任务的人请教思路，弄清楚方向再自己动手",
      poleValue: 72,
      weights: { collaboration: 1.0, communication: 0.6 },
    },
    {
      label: "D",
      text: "主动告知上级任务对我来说是全新挑战，询问能否提供更多支持或一起讨论方向",
      poleValue: 82,
      weights: { communication: 0.9, stress: 0.5 },
    },
  ],
};

const SJT_02: QuizQuestion = {
  id: "SJT-02",
  dimension: "personality",
  text: "你被要求独自向一个从未接触过该项目的客户做简报，时间只有 15 分钟。你会怎么准备？",
  options: [
    {
      label: "A",
      text: "收集所有项目资料，每个细节都准备好，宁可材料太多",
      poleValue: 28,
      weights: { data: 0.8, execution: 0.5 },
    },
    {
      label: "B",
      text: "先弄清楚客户最关心的 2-3 个问题，专注把这几点说清楚",
      poleValue: 72,
      weights: { communication: 1.0, execution: 0.6 },
    },
    {
      label: "C",
      text: "找项目组同事帮忙补充我不熟悉的部分，合作准备",
      poleValue: 55,
      weights: { collaboration: 0.9, communication: 0.5 },
    },
    {
      label: "D",
      text: "提前预演一遍，计时，确保 15 分钟内能把核心讲完",
      poleValue: 38,
      weights: { execution: 1.0, stress: 0.4 },
    },
  ],
};

const SJT_03: QuizQuestion = {
  id: "SJT-03",
  dimension: "workstyle",
  text: "手头同时有三项任务，截止日期都在本周。你会怎么安排？",
  options: [
    {
      label: "A",
      text: "按紧急程度排序，先做最急的，做完一项再做下一项",
      poleValue: 25,
      weights: { execution: 1.0, stress: 0.5 },
    },
    {
      label: "B",
      text: "估算每项工作量，给每项分配时间块，交叉推进",
      poleValue: 35,
      weights: { execution: 0.9, data: 0.7 },
    },
    {
      label: "C",
      text: "问一下各方哪项最优先，按他们的期待来安排顺序",
      poleValue: 78,
      weights: { communication: 0.9, collaboration: 0.6 },
    },
    {
      label: "D",
      text: "先把能快速完成的做掉，建立节奏，再处理复杂的",
      poleValue: 22,
      weights: { execution: 0.8, learning: 0.4 },
    },
  ],
};

const SJT_04: QuizQuestion = {
  id: "SJT-04",
  dimension: "value",
  text: "工作中要求你用一个完全没用过的新工具，并在三天内产出结果。你会怎么做？",
  options: [
    {
      label: "A",
      text: "直接动手试，边用边看官方文档，出错再查",
      poleValue: 82,
      weights: { learning: 1.0, execution: 0.6 },
    },
    {
      label: "B",
      text: "先花一两个小时系统看教程，搞清楚基本逻辑再开始",
      poleValue: 55,
      weights: { learning: 0.9, data: 0.6 },
    },
    {
      label: "C",
      text: "找用过这个工具的人请教，让他们帮我快速上手",
      poleValue: 60,
      weights: { collaboration: 1.0, communication: 0.6 },
    },
    {
      label: "D",
      text: "如果来不及，提前说明风险并建议用熟悉的方案替代",
      poleValue: 20,
      weights: { communication: 0.8, stress: 0.5 },
    },
  ],
};

const SJT_05: QuizQuestion = {
  id: "SJT-05",
  dimension: "direction",
  text: "你正在全力推进一项工作时，上级突然说要把截止日期提前两天。你的第一反应是什么？",
  options: [
    {
      label: "A",
      text: "立刻重新评估任务，看哪些可以简化，保证提前交付",
      poleValue: 32,
      weights: { execution: 1.0, stress: 0.6 },
    },
    {
      label: "B",
      text: "告诉上级现在的进展和风险，一起商量什么可以提前交付",
      poleValue: 78,
      weights: { communication: 1.0, collaboration: 0.5 },
    },
    {
      label: "C",
      text: "加班加点，想办法在新截止日前完成，不让上级失望",
      poleValue: 18,
      weights: { execution: 0.8, stress: 0.7 },
    },
    {
      label: "D",
      text: "先冷静下来，想清楚哪部分最核心，集中精力保核心先出",
      poleValue: 42,
      weights: { stress: 1.0, data: 0.5 },
    },
  ],
};

const SJT_06: QuizQuestion = {
  id: "SJT-06",
  dimension: "personality",
  text: "你认为某个常用的做事方法效率很低，有更好的方案，但团队一直在用旧方法。你会怎么做？",
  options: [
    {
      label: "A",
      text: "默默按旧方法做，在自己权限内小范围测试新方案",
      poleValue: 20,
      weights: { execution: 0.8, learning: 0.6 },
    },
    {
      label: "B",
      text: "找合适时机向负责人提出来，展示新方案的具体好处",
      poleValue: 75,
      weights: { communication: 1.0, execution: 0.5 },
    },
    {
      label: "C",
      text: "先和几个同事聊，看他们是否也有同感，再集体提出",
      poleValue: 82,
      weights: { collaboration: 1.0, communication: 0.7 },
    },
    {
      label: "D",
      text: "研究一下为什么用旧方法，弄清楚背后原因再决定要不要提",
      poleValue: 35,
      weights: { data: 0.9, learning: 0.7 },
    },
  ],
};

const SJT_07: QuizQuestion = {
  id: "SJT-07",
  dimension: "value",
  text: "你负责整理一份有大量数据的分析报告，数据来源混乱、格式各异。你会怎么处理？",
  options: [
    {
      label: "A",
      text: "先把所有数据汇总进来，统一格式，再逐步分析",
      poleValue: 22,
      weights: { data: 1.0, execution: 0.6 },
    },
    {
      label: "B",
      text: "先弄清楚报告的核心问题，只收集与核心问题相关的数据",
      poleValue: 65,
      weights: { data: 0.8, communication: 0.5 },
    },
    {
      label: "C",
      text: "找数据来源的负责人沟通，请他们统一格式再给我",
      poleValue: 35,
      weights: { collaboration: 0.9, communication: 0.7 },
    },
    {
      label: "D",
      text: "搜索有没有现成工具或模板可以帮助快速整理这类数据",
      poleValue: 78,
      weights: { learning: 1.0, data: 0.5 },
    },
  ],
};

const SJT_09: QuizQuestion = {
  id: "SJT-09",
  dimension: "direction",
  text: "你加入了一个新项目，发现大家各自为战、缺少统一节奏。你会怎么做？",
  options: [
    {
      label: "A",
      text: "专注做好自己分内的部分，不越权干涉别人的工作",
      poleValue: 20,
      weights: { execution: 1.0, stress: 0.4 },
    },
    {
      label: "B",
      text: "把自己负责的模块做完整，顺手帮旁边人解答疑问",
      poleValue: 38,
      weights: { execution: 0.8, collaboration: 0.5 },
    },
    {
      label: "C",
      text: "主动和几个核心成员拉通一下，把各自进度和依赖说清楚",
      poleValue: 72,
      weights: { communication: 1.0, collaboration: 0.7 },
    },
    {
      label: "D",
      text: "建议组织一次简短站会，把整体进度和分工梳理清楚",
      poleValue: 85,
      weights: { communication: 0.9, collaboration: 0.8 },
    },
  ],
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  SJT_01,
  SJT_02,
  SJT_04,
  SJT_05,
  SJT_03,
  SJT_06,
  SJT_07,
  SJT_09,
];

export const QUIZ_QUESTION_IDS = [
  "SJT-01",
  "SJT-02",
  "SJT-04",
  "SJT-05",
  "SJT-03",
  "SJT-06",
  "SJT-07",
  "SJT-09",
] as const;

export function getQuestion(id: string): QuizQuestion | undefined {
  return QUIZ_QUESTIONS.find((q) => q.id === id);
}

export function nextUnansweredQuestionId(
  answeredIds: Set<string>,
): string | null {
  for (const q of QUIZ_QUESTIONS) {
    if (!answeredIds.has(q.id)) {
      return q.id;
    }
  }
  return null;
}
