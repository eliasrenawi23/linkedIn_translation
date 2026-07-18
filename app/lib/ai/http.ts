import { NextResponse } from "next/server";
import { InputError } from "../input-validation";
import { AiError } from "./provider";
import { SchemaValidationError } from "./schemas";

export function aiRouteError(error: unknown, fallbackMessage: string): NextResponse {
  console.error("Unexpected AI route error:", error);

  if (error instanceof InputError) return NextResponse.json({ error: error.message, code: "INVALID_INPUT" }, { status: 400 });
  if (error instanceof AiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof SchemaValidationError) {
    return NextResponse.json({ error: `Validation Error: ${error.message}`, code: "AI_INVALID_RESPONSE" }, { status: 502 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : fallbackMessage, code: "INTERNAL_ERROR" }, { status: 500 });
}
