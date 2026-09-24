"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api-base";
import type { ReportData } from "@/lib/career/types";
import { ReportView } from "@/components/report/report-view";

export default function ReportPage() {
  const params = useParams<{ reportUuid: string }>();
  const reportUuid = params.reportUuid;
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl(`/api/report/${reportUuid}`));
        if (!res.ok) {
          const body = await res.json();
          setError(body.error?.message ?? "加载失败");
          return;
        }
        const json = await res.json();
        setReport(json.report as ReportData);
      } catch {
        setError("加载失败");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reportUuid]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-gray-500">
        加载中…
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg text-gray-700">
          {error ?? "没有找到对应内容"}
        </p>
        <Link href="/" className="text-blue-600 underline">
          返回对话
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-gray-200 px-4 py-3">
        <Link href="/" className="text-sm text-blue-600">
          ← 返回对话
        </Link>
      </header>
      <ReportView report={report} />
    </div>
  );
}
