import { LlmError, type ProviderName } from "./types";

export type BananaRouterConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

export type { ProviderName };

export function getBananaRouterConfig(
  env: Record<string, string | undefined> = process.env,
): BananaRouterConfig {
  const apiKey = env.BANANAROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new LlmError("not_configured", "缺少环境变量 BANANAROUTER_API_KEY");
  }

  const baseURL = env.BANANAROUTER_BASE_URL?.trim();
  if (!baseURL) {
    throw new LlmError("not_configured", "缺少环境变量 BANANAROUTER_BASE_URL");
  }

  const model = env.BANANAROUTER_MODEL?.trim();
  if (!model) {
    throw new LlmError("not_configured", "缺少环境变量 BANANAROUTER_MODEL");
  }

  return {
    apiKey,
    baseURL: baseURL.replace(/\/+$/, ""),
    model,
  };
}

export function isMockMode(): boolean {
  return process.env.E2E_MOCK_MODE === "true";
}
