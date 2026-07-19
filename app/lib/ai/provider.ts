import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { AI_PROVIDERS, AI_REQUEST_TIMEOUT_MS, AI_TRANSIENT_RETRIES, getProviderApiKey, type AiProvider } from "./config";
import { parseStructuredJson, StructuredJsonError } from "./json";
import { addCurrentDateContext } from "./date-context";

export type AiErrorCode = "AI_NOT_CONFIGURED" | "AI_TIMEOUT" | "AI_UNAVAILABLE" | "AI_INVALID_RESPONSE" | "AI_PROVIDER_ERROR";

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;
  readonly providerResponse?: unknown;

  constructor(code: AiErrorCode, message: string, status: number, providerResponse?: unknown) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status = status;
    this.providerResponse = providerResponse;
  }
}

type GenerateOptions = {
  provider: AiProvider;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  logResponse?: boolean;
};

function timeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new AiError("AI_TIMEOUT", "The AI provider took too long to respond.", 504)), AI_REQUEST_TIMEOUT_MS)),
  ]);
}

function isTransient(error: unknown): boolean {
  if (error instanceof StructuredJsonError) return true;
  if (error instanceof AiError) return error.code === "AI_TIMEOUT" || error.code === "AI_UNAVAILABLE";
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }
  return false;
}

function providerError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  const value = typeof error === "object" && error !== null ? error as Record<string, unknown> : null;
  const status = value && typeof value.status === "number" ? value.status : 502;
  const response = value?.error ?? (error instanceof Error ? { message: error.message } : error);
  const responseRecord = typeof response === "object" && response !== null ? response as Record<string, unknown> : null;
  const nestedError = responseRecord && typeof responseRecord.error === "object" && responseRecord.error !== null
    ? responseRecord.error as Record<string, unknown>
    : null;
  const message = typeof nestedError?.message === "string"
    ? nestedError.message
    : typeof responseRecord?.message === "string"
      ? responseRecord.message
      : error instanceof Error ? error.message : "The AI provider rejected the request.";
  const code: AiErrorCode = status === 408 || status === 429 || status >= 500 ? "AI_UNAVAILABLE" : "AI_PROVIDER_ERROR";
  return new AiError(code, message, status, response);
}

async function generateOnce(options: GenerateOptions, apiKey: string): Promise<string> {
  const config = AI_PROVIDERS[options.provider];
  if (options.provider === "openai") {
    const client = new OpenAI({ apiKey, timeout: AI_REQUEST_TIMEOUT_MS, maxRetries: 0 });
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: "system", content: options.systemPrompt }, { role: "user", content: options.userPrompt }],
      response_format: { type: "json_object" },
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });
    return response.choices[0]?.message.content ?? "";
  }

  if (options.provider === "anthropic") {
    const client = new Anthropic({ apiKey, timeout: AI_REQUEST_TIMEOUT_MS, maxRetries: 0 });
    const response = await client.messages.create({
      model: config.model,
      max_tokens: options.maxTokens,
      system: `${options.systemPrompt}\n\nReturn only valid JSON without markdown fences.`,
      messages: [{ role: "user", content: options.userPrompt }],
    });
    const block = response.content.find((item) => item.type === "text");
    return block?.type === "text" ? block.text : "";
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: config.model, systemInstruction: options.systemPrompt });
  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: options.userPrompt }] }],
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.provider === "gemini" ? 8192 : options.maxTokens,
      responseMimeType: "application/json"
    },
  });
  return response.response.text();
}

export async function generateStructured(options: GenerateOptions): Promise<unknown> {
  const apiKey = getProviderApiKey(options.provider);
  if (!apiKey) throw new AiError("AI_NOT_CONFIGURED", `${AI_PROVIDERS[options.provider].name} is not configured.`, 503);

  const datedOptions: GenerateOptions = { ...options, systemPrompt: addCurrentDateContext(options.systemPrompt) };
  let lastError: unknown;
  for (let attempt = 0; attempt <= AI_TRANSIENT_RETRIES; attempt += 1) {
    let content: string | undefined;
    try {
      content = await timeout(generateOnce(datedOptions, apiKey));
      if (options.logResponse !== false && process.env.NODE_ENV !== "production") {
        console.info(`[Raw AI Response from ${options.provider} (Attempt ${attempt + 1})]:\n${content}`);
      }
      return parseStructuredJson(content);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error(`Error during AI generation (attempt ${attempt + 1}):`, error);
      lastError = error instanceof StructuredJsonError
        ? new AiError("AI_INVALID_RESPONSE", "The AI provider returned malformed structured data.", 502, content)
        : providerError(error);
      if (attempt === AI_TRANSIENT_RETRIES || !isTransient(error)) break;
    }
  }

  throw providerError(lastError);
}
