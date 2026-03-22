import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `
You are a cynical, brutal translator of corporate LinkedIn posts. 
Return a JSON object with exactly three keys: 
1. "headline" (a short, mocking translation of the core message)
2. "translation" (a short, brutal summary stripping away all corporate jargon)
3. "score" (an integer from 0 to 100 representing the 'Bullshit Score')
`;

export async function POST(req: Request) {
  try {
    const { post_text, provider = "gemini" } = await req.json();

    if (!post_text) {
      return NextResponse.json({ error: "post_text is required" }, { status: 400 });
    }

    let result_content = "";

    if (provider === "openai") {
      if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Please translate this LinkedIn post:\n\n${post_text}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      result_content = response.choices[0].message.content || "{}";

    } else if (provider === "anthropic") {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + "\n\nYou MUST return ONLY valid JSON. Do not include markdown formatting or any other text.",
        messages: [
          { role: "user", content: `Please translate this LinkedIn post:\n\n${post_text}` }
        ],
        temperature: 0.7,
      });
      // @ts-expect-error type mismatches due to anthropic SDK versioning
      result_content = response.content[0].text || "{}";

    } else if (provider === "gemini") {
      if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const prompt = `${SYSTEM_PROMPT}\n\nPlease translate this LinkedIn post and output only JSON:\n\n${post_text}`;
      
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }]}],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        }
      });
      result_content = result.response.text();
      
    } else {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    // Clean up possible markdown wrappers
    result_content = result_content.trim();
    if (result_content.startsWith("```json")) result_content = result_content.substring(7);
    if (result_content.startsWith("```")) result_content = result_content.substring(3);
    if (result_content.endsWith("```")) result_content = result_content.slice(0, -3);

    const result_json = JSON.parse(result_content.trim());

    return NextResponse.json({
      headline: result_json.headline || "",
      translation: result_json.translation || "",
      score: result_json.score || 0
    });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`Error during translation:`, error);
    return NextResponse.json({ error: error.message || "An error occurred" }, { status: 500 });
  }
}
