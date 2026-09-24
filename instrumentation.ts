export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "production" && process.env.E2E_MOCK_MODE === "true") {
    throw new Error("E2E_MOCK_MODE must not be enabled in production");
  }
  if (process.env.E2E_MOCK_MODE !== "true") {
    const { getBananaRouterConfig } = await import("./lib/llm/config");
    getBananaRouterConfig();
  }
  const { recoverInterruptedReportJobs } = await import("./lib/career/report/jobs");
  recoverInterruptedReportJobs();
}
