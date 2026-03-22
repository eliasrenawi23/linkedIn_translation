import { NextResponse } from 'next/server';

export async function GET() {
  const models = [
    { id: "gemini", name: "Google (Gemini 3 Flash Preview)", available: true },
    { id: "openai", name: "OpenAI (GPT-4o-mini)", available: false },
    { id: "anthropic", name: "Anthropic (Claude 3.5)", available: false }
  ];
  return NextResponse.json(models);
}
