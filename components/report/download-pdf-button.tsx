"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api-base";

interface Props {
  reportUuid: string;
}

export function DownloadPdfButton({ reportUuid }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (loading) return;
    setLoading(true);
    const url = apiUrl(`/api/report/${reportUuid}/pdf`);
    window.open(url, "_blank");
    setTimeout(() => setLoading(false), 3000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 print:hidden"
    >
      {loading ? "生成中…" : "下载 PDF 报告"}
    </button>
  );
}
