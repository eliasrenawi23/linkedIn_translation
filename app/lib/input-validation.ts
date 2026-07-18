export const MAX_RESUME_CHARS = 60_000;
export const MAX_JOB_DESCRIPTION_CHARS = 80_000;
export const MAX_POST_CHARS = 30_000;
export const MAX_RESUME_FILE_BYTES = 8 * 1024 * 1024;

export function readRequiredString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new InputError(`${label} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new InputError(`${label} is too long (maximum ${maxLength.toLocaleString()} characters)`);
  }

  return normalized;
}

export function readProvider(value: unknown): "gemini" | "openai" | "anthropic" {
  const provider = value ?? "gemini";
  if (provider !== "gemini" && provider !== "openai" && provider !== "anthropic") {
    throw new InputError("Unknown AI provider");
  }
  return provider;
}

export class InputError extends Error {}
