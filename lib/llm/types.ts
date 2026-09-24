export type ProviderName = "bananarouter" | "mock";

export type LlmErrorCategory =
  | "not_configured"
  | "unauthorized"
  | "rate_limited"
  | "provider_error"
  | "timeout"
  | "network_error"
  | "invalid_response"
  | "invalid_json"
  | "blocked"
  | "validation_failed";

export class LlmError extends Error {
  constructor(
    public category: LlmErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export type NeutralMessage = { role: "user" | "assistant"; text: string };

export type JsonSchemaLite = {
  type: "object" | "string" | "number" | "integer" | "boolean" | "array";
  description?: string;
  properties?: Record<string, JsonSchemaLite>;
  required?: string[];
  enum?: string[];
  items?: JsonSchemaLite;
};

export type NeutralTool = {
  name: string;
  description: string;
  parameters: JsonSchemaLite;
};

export type ToolCall = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

export type ToolResult = {
  call: ToolCall;
  response: Record<string, unknown>;
};

export type TurnState = {
  provider: ProviderName;
  data: unknown;
};

export interface ChatAdapter {
  provider: ProviderName;
  model: string;
  chat(input: {
    system: string;
    history: NeutralMessage[];
    turnState: TurnState | null;
    toolResults?: ToolResult[];
    tools: NeutralTool[];
    allowTools: boolean;
    timeoutMs: number;
  }): Promise<{
    text: string;
    toolCalls: ToolCall[];
    finish: "stop" | "max_tokens" | "blocked";
    finishReason: string;
    turnState: TurnState;
    usage?: { promptTokens?: number; completionTokens?: number };
  }>;
}

export interface JsonProvider {
  provider: ProviderName;
  model: string;
  completeJsonText(input: {
    system: string;
    user: string;
    maxOutputTokens: number;
    temperature: number;
    timeoutMs: number;
  }): Promise<{
    text: string;
    finishReason: string;
    usage?: { promptTokens?: number; completionTokens?: number };
  }>;
}
