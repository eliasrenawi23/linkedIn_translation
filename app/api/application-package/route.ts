import { NextResponse } from "next/server";
import { aiRouteError, validateAiOutput } from "@/app/lib/ai/http";
import { generateStructured } from "@/app/lib/ai/provider";
import { SchemaValidationError, validateApplicationPackage, validateRequirementEvidence } from "@/app/lib/ai/schemas";
import { InputError, MAX_JOB_DESCRIPTION_CHARS, MAX_RESUME_CHARS, readProvider, readRequiredString } from "@/app/lib/input-validation";

const SYSTEM_PROMPT = `
You are an evidence-based career writer helping a candidate apply for a job.
Create application materials using only the supplied resume, job description, and verified requirement evidence.
Never invent experience, skills, employers, metrics, achievements, education, certifications, motivation, or personal familiarity with the company.
When company-specific information is absent, express interest in the role and its stated work without claiming unsupported knowledge.
Return only valid JSON matching the requested structure, without markdown fences.
`;

type Tone = "professional" | "warm" | "direct";
type Length = "concise" | "standard" | "detailed";

function option<T extends string>(value: unknown, values: readonly T[], fallback: T, label: string): T {
  const resolved = value ?? fallback;
  if (typeof resolved !== "string" || !values.includes(resolved as T)) throw new InputError(`${label} is invalid`);
  return resolved as T;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = body as Record<string, unknown>;
    const resume = readRequiredString(input.resume, "Resume text", MAX_RESUME_CHARS);
    const jobDescription = readRequiredString(input.job_description, "Job description", MAX_JOB_DESCRIPTION_CHARS);
    const provider = readProvider(input.provider);
    const requirements = validateRequirementEvidence(input.requirements);
    const tone = option<Tone>(input.tone, ["professional", "warm", "direct"], "professional", "Tone");
    const length = option<Length>(input.length, ["concise", "standard", "detailed"], "standard", "Length");

    const result = await generateStructured({
      provider,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `
Tone: ${tone}
Length: ${length}

Length guidance:
- concise: cover letter 120-180 words; recruiter message 40-70 words; short remaining answers
- standard: cover letter 200-300 words; recruiter message 60-100 words
- detailed: cover letter 300-450 words; recruiter message 80-130 words
- connectionNote must always be at most 280 characters

Return exactly this JSON structure:
{
  "coverLetter": "A tailored cover letter grounded only in supplied evidence",
  "recruiterMessage": "A message suitable for a recruiter",
  "connectionNote": "A connection note no longer than 280 characters",
  "whyThisCompany": "An honest response based on the role and company information stated in the job description",
  "interviewTalkingPoints": ["3-8 concise, evidence-based points the candidate can discuss"]
}

Verified requirement evidence:
${JSON.stringify(requirements)}

Candidate resume:
"""
${resume}
"""

Job description:
"""
${jobDescription}
"""
`,
      temperature: 0.4,
      maxTokens: 4096,
    });

    const applicationPackage = validateAiOutput(result, validateApplicationPackage);
    if (applicationPackage.connectionNote.length > 280) {
      throw new SchemaValidationError("connectionNote must not exceed 280 characters");
    }
    return NextResponse.json(applicationPackage);
  } catch (error: unknown) {
    return aiRouteError(error, "Could not generate the application package.");
  }
}
