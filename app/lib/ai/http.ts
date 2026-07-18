import { NextResponse } from "next/server";
import { InputError } from "../input-validation";
import { AiError } from "./provider";
import { SchemaValidationError } from "./schemas";

export function aiRouteError(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof InputError) return NextResponse.json({ error: error.message, code: "INVALID_INPUT" }, { status: 400 });
  if (error instanceof AiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof SchemaValidationError) {
    return NextResponse.json({ error: "The AI provider returned an invalid result. Please try again.", code: "AI_INVALID_RESPONSE" }, { status: 502 });
  }
  console.error("Unexpected AI route error", error instanceof Error ? error.name : typeof error);
  return NextResponse.json({ error: fallbackMessage, code: "INTERNAL_ERROR" }, { status: 500 });
}
