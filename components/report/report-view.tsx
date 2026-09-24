import type { ReportData } from "@/lib/career/types";
import { COPY } from "@/lib/career/copy";

type ReportViewProps = {
  report: ReportData;
};

export function ReportView({ report }: ReportViewProps) {
  const hasResume = report.meta.hasResume && report.resumeDiagnosis;

  return (
    <article className="mx-auto max-w-[720px] space-y-8 px-4 py-8 text-base">
      <header>
        <h1 className="text-2xl font-bold">职业导航报告</h1>
        <p className="mt-1 text-sm text-gray-500">
          {report.overview.personality.type}
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold">总评</h2>
        <p className="mb-4 text-gray-700">{report.overview.summary}</p>
        <div className="space-y-3">
          {report.overview.fourDimRadar.map((dim) => (
            <div key={dim.name} className="rounded-lg bg-gray-50 p-3">
              <p className="font-medium">{dim.name}</p>
              <p className="text-sm text-gray-600">
                得分 {dim.score}
                {dim.conclusion ? ` · ${dim.conclusion}` : ""}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-gray-700">
          {report.overview.personality.description}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">优势发现</h2>
        <div className="mb-4 space-y-2">
          {report.strength.abilityRadar.map((a) => (
            <div key={a.name} className="flex justify-between text-sm">
              <span>{a.name}</span>
              <span className="text-gray-500">{a.score}</span>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {report.strength.strengths.map((s) => (
            <div key={s.title}>
              <h3 className="font-medium">{s.title}</h3>
              <p className="text-gray-700">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">职业定位</h2>
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">首选岗位</p>
            <p className="text-lg font-medium">
              {report.positioning.primary.position}
            </p>
            <p className="mt-2 text-gray-700">
              {report.positioning.primary.reasoning}
            </p>
            {report.positioning.primary.fitReason && (
              <p className="mt-2 text-sm text-gray-600">
                {report.positioning.primary.fitReason}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">次选岗位</p>
            <p className="text-lg font-medium">
              {report.positioning.secondary.position}
            </p>
            <p className="mt-2 text-gray-700">
              {report.positioning.secondary.reasoning}
            </p>
          </div>
        </div>
      </section>

      {hasResume && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">简历快诊</h2>
          <p className="mb-3 text-sm text-gray-500">
            综合得分：{report.resumeDiagnosis!.overallScore}
          </p>
          <div className="space-y-4">
            {report.resumeDiagnosis!.issues.map((issue) => (
              <div key={issue.title} className="rounded-lg bg-gray-50 p-3">
                <p className="font-medium">
                  {issue.title}
                  <span className="ml-2 text-xs text-gray-500">
                    {issue.priority}
                  </span>
                </p>
                <p className="text-gray-700">{issue.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-semibold">行动计划</h2>
        <ol className="list-decimal space-y-4 pl-5">
          {report.advice.topThree.map((item) => (
            <li key={item.title}>
              <p className="font-medium">{item.title}</p>
              <p className="text-gray-700">{item.detail}</p>
              <p className="text-sm text-gray-500">{item.deadline}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-gray-200 pt-6 text-xs text-gray-500">
        {COPY.disclaimer}
      </footer>
    </article>
  );
}
