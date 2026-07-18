import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { AI_PROVIDERS, AI_REQUEST_TIMEOUT_MS, AI_TRANSIENT_RETRIES, getProviderApiKey, type AiProvider } from "./config";
import { parseStructuredJson, StructuredJsonError } from "./json";

export type AiErrorCode = "AI_NOT_CONFIGURED" | "AI_TIMEOUT" | "AI_UNAVAILABLE" | "AI_INVALID_RESPONSE";

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;

  constructor(code: AiErrorCode, message: string, status: number) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status = status;
  }
}

type GenerateOptions = {
  provider: AiProvider;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
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
      temperature: options.temperature,
    });
    const block = response.content.find((item) => item.type === "text");
    return block?.type === "text" ? block.text : "";
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: config.model, systemInstruction: options.systemPrompt });
  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: options.userPrompt }] }],
    generationConfig: { temperature: options.temperature, maxOutputTokens: options.maxTokens, responseMimeType: "application/json" },
  });
  return response.response.text();
}

export async function generateStructured(options: GenerateOptions): Promise<unknown> {
  const apiKey = getProviderApiKey(options.provider);
  if (!apiKey) throw new AiError("AI_NOT_CONFIGURED", `${AI_PROVIDERS[options.provider].name} is not configured.`, 503);

  let lastError: unknown;
  for (let attempt = 0; attempt <= AI_TRANSIENT_RETRIES; attempt += 1) {
    try {
      const content = await timeout(generateOnce(options, apiKey));
      if (process.env.NODE_ENV !== "production") {
        console.info(`[AI response:${options.provider}:attempt ${attempt + 1}]\n${content}`);
      }
      return parseStructuredJson(content);
    } catch (error) {
      lastError = error instanceof StructuredJsonError
        ? new AiError("AI_INVALID_RESPONSE", "The AI provider returned malformed structured data.", 502)
        : error;
      if (attempt === AI_TRANSIENT_RETRIES || !isTransient(error)) break;
    }
  }

  if (lastError instanceof AiError) throw lastError;
  throw new AiError("AI_UNAVAILABLE", "The AI provider is temporarily unavailable.", 503);
}
