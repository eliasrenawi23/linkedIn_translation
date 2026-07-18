import { NextResponse } from 'next/server';
import { MAX_POST_CHARS, readProvider, readRequiredString } from '@/app/lib/input-validation';
import { generateStructured } from '@/app/lib/ai/provider';
import { validateTranslationResult } from '@/app/lib/ai/schemas';
import { aiRouteError } from '@/app/lib/ai/http';

const SYSTEM_PROMPT = `
You are a cynical, brutal translator of corporate LinkedIn posts. 
Return a JSON object with exactly three keys: 
1. "headline" (a short, mocking translation of the core message)
2. "translation" (a short, brutal summary stripping away all corporate jargon)
3. "score" (an integer from 0 to 100 representing the 'Bullshit Score')
`;

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const post_text = readRequiredString((body as { post_text?: unknown })?.post_text, "Post text", MAX_POST_CHARS);
    const provider = readProvider((body as { provider?: unknown })?.provider);

    const result = await generateStructured({
      provider,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Please translate this LinkedIn post:\n\n${post_text}`,
      temperature: 0.7,
      maxTokens: 1024,
    });
    return NextResponse.json(validateTranslationResult(result));

  } catch (err: unknown) {
    return aiRouteError(err, "An error occurred during translation.");
  }
}
