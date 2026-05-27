import { NextResponse } from 'next/server';

export async function GET() {
  const models = [
    { id: "gemini", name: "Google (Gemini 3.5 Flash)", available: !!process.env.GEMINI_API_KEY },
    { id: "openai", name: "OpenAI (GPT-4o-mini)", available: !!process.env.OPENAI_API_KEY },
    { id: "anthropic", name: "Anthropic (Claude 3.5)", available: !!process.env.ANTHROPIC_API_KEY }
  ];
  return NextResponse.json(models);
}
