import { NextResponse } from "next/server";
import { InputError } from "../input-validation";
import { AiError } from "./provider";
import { SchemaValidationError } from "./schemas";

export class AiOutputValidationError extends Error {
  constructor(public readonly providerResponse: unknown, public readonly validationError: unknown) {
    super("The AI provider returned an invalid result.");
    this.name = "AiOutputValidationError";
  }
}

export function validateAiOutput<T>(value: unknown, validator: (input: unknown) => T): T {
  try {
    return validator(value);
  } catch (error) {
    console.error("AI response failed runtime validation. Full response:", value);
    throw new AiOutputValidationError(value, error);
  }
}

export function aiRouteError(error: unknown, fallbackMessage: string): NextResponse {
  console.error("Unexpected AI route error:", error);

  if (error instanceof InputError) return NextResponse.json({ error: error.message, code: "INVALID_INPUT" }, { status: 400 });
  if (error instanceof AiError) {
    if (error.providerResponse !== undefined) console.error("Full malformed AI response:", error.providerResponse);
    return NextResponse.json({ error: error.message, code: error.code, providerResponse: error.providerResponse }, { status: error.status });
  }
  if (error instanceof AiOutputValidationError) {
    return NextResponse.json({
      error: "The AI provider returned an invalid result. See the full response below.",
      code: "AI_INVALID_RESPONSE",
      providerResponse: error.providerResponse,
      validationError: error.validationError instanceof Error ? error.validationError.message : String(error.validationError),
    }, { status: 502 });
  }
  if (error instanceof SchemaValidationError) {
    return NextResponse.json({ error: `Validation Error: ${error.message}`, code: "AI_INVALID_RESPONSE" }, { status: 502 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : fallbackMessage, code: "INTERNAL_ERROR" }, { status: 500 });
}
