export type AiProvider = "gemini" | "openai" | "anthropic";

type ProviderConfig = {
  id: AiProvider;
  name: string;
  model: string;
  apiKeyEnvironmentVariable: "GEMINI_API_KEY" | "OPENAI_API_KEY" | "ANTHROPIC_API_KEY";
};

export const AI_PROVIDERS: Record<AiProvider, ProviderConfig> = {
  gemini: {
    id: "gemini",
    name: "Google (Gemini 3.5 Flash)",
    model: "gemini-3.5-flash",
    apiKeyEnvironmentVariable: "GEMINI_API_KEY",
  },
  openai: {
    id: "openai",
    name: "OpenAI (GPT-4o-mini)",
    model: "gpt-4o-mini",
    apiKeyEnvironmentVariable: "OPENAI_API_KEY",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic (Claude Sonnet 5)",
    model: "claude-sonnet-5",
    apiKeyEnvironmentVariable: "ANTHROPIC_API_KEY",
  },
};

export const AI_REQUEST_TIMEOUT_MS = 90_000;
export const AI_TRANSIENT_RETRIES = 1;

export function getProviderApiKey(provider: AiProvider): string | undefined {
  return process.env[AI_PROVIDERS[provider].apiKeyEnvironmentVariable];
}
