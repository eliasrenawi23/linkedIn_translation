import { NextResponse } from "next/server";
import { AI_PROVIDERS, type AiProvider } from "@/app/lib/ai/config";
import { validateAiOutput } from "@/app/lib/ai/http";
import { generateStructured, AiError } from "@/app/lib/ai/provider";
import { aggregateModelReviews, validateModelReview } from "@/app/lib/ai/schemas";
import { InputError, MAX_JOB_DESCRIPTION_CHARS, MAX_RESUME_CHARS, readProvider, readRequiredString } from "@/app/lib/input-validation";

const SYSTEM_PROMPT = `
You are a critical, evidence-based technical recruiter comparing a resume with a job description.
Use only supplied text. Never invent candidate experience or requirements.
Apply this scoring rubric consistently: 75-100 Apply, 50-74 Apply with Reservations, 0-49 Do Not Apply; a missing critical must-have may lower the recommendation.
Return only valid JSON with exactly the requested fields and no markdown.
`;

function readProviders(value: unknown): AiProvider[] {
  if (!Array.isArray(value)) throw new InputError("Select two or three AI providers");
  const providers = value.map(readProvider);
  const unique = [...new Set(providers)];
  if (unique.length < 2 || unique.length > 3 || unique.length !== providers.length) throw new InputError("Select two or three distinct AI providers");
  return unique;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = body as Record<string, unknown>;
    const resume = readRequiredString(input.resume, "Resume text", MAX_RESUME_CHARS);
    const jobDescription = readRequiredString(input.job_description, "Job description", MAX_JOB_DESCRIPTION_CHARS);
    const providers = readProviders(input.providers);
    const userPrompt = `
Return exactly this JSON structure:
{
  "score": 75,
  "recommendation": "Apply",
  "matchingSkills": ["3-8 requirements supported by resume evidence"],
  "missingSkills": ["0-8 important requirements missing or weak in the resume"],
  "criticalGaps": ["Only missing must-have requirements; empty if none"],
  "summary": "2-3 concise sentences explaining the score using the strongest matches and gaps"
}

Resume:
"""
${resume}
"""

Job description:
"""
${jobDescription}
"""
`;

    const settled = await Promise.allSettled(providers.map(async (provider) => {
      const startedAt = performance.now();
      const raw = await generateStructured({ provider, systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.2, maxTokens: 2048, logResponse: false });
      return validateAiOutput(raw, (value) => validateModelReview(value, provider, performance.now() - startedAt));
    }));

    const reviews = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const failures = settled.flatMap((result, index) => {
      if (result.status === "fulfilled") return [];
      const error = result.reason;
      const providerResponse = typeof error === "object" && error !== null && "providerResponse" in error ? error.providerResponse : undefined;
      if (providerResponse !== undefined) console.error(`Full comparison error response from ${providers[index]}:`, providerResponse);
      return [{ provider: providers[index], error: error instanceof Error ? error.message : "This provider could not complete the review.", providerResponse }];
    });
    if (!reviews.length) throw new AiError("AI_UNAVAILABLE", "None of the selected providers completed the review.", 503);

    return NextResponse.json({
      reviews,
      failures,
      consensus: aggregateModelReviews(reviews),
      comparedAt: new Date().toISOString(),
      providerNames: Object.fromEntries(providers.map((provider) => [provider, AI_PROVIDERS[provider].name])),
    });
  } catch (error: unknown) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message, code: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof AiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Could not complete the model comparison.", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
