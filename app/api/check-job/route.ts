import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { InputError, MAX_JOB_DESCRIPTION_CHARS, MAX_RESUME_CHARS, readProvider, readRequiredString } from '@/app/lib/input-validation';

const SYSTEM_PROMPT = `
You are a senior technical recruiter, hiring manager, ATS reviewer, and career coach.

Your task is to evaluate how well a candidate's resume matches a specific job description.
You must be critical, evidence-based, practical, and fair.

You will receive:
1. Candidate resume text
2. Job description text

Analyze ONLY the information provided in the resume and job description.
Do NOT invent experience, skills, tools, years of experience, certifications, education, or achievements that are not clearly supported by the resume.
Do NOT use outside knowledge about the candidate.
Do NOT be overly positive. Penalize real gaps clearly.
Do NOT reject a candidate only because the resume wording is different if the same skill is strongly implied by projects, tools, responsibilities, or technologies.

Evaluation rules:
- Treat explicit job requirements as more important than nice-to-have skills.
- A skill counts as "matching" only if it appears directly in the resume or is strongly evidenced by equivalent experience.
- A skill counts as "missing" if it is important in the job description and is absent, weakly represented, or only vaguely implied in the resume.
- If the job requires a specific seniority level, years of experience, domain experience, language, location, work authorization, or certification, include that in the evaluation.
- If the job description is vague, evaluate based on the strongest repeated signals in it.
- If the resume is vague, score conservatively.
- Prefer concrete evidence over generic claims.
- Focus especially on technical stack, role responsibilities, seniority, business/domain fit, and measurable achievements.

Scoring rubric:
- 90-100: Exceptional match. Resume strongly satisfies almost all major requirements, including must-have skills and seniority.
- 75-89: Strong match. Candidate should apply. Some minor gaps may exist, but the core fit is clear.
- 60-74: Moderate match. Candidate can apply with reservations. Several gaps or weak evidence exist.
- 40-59: Weak match. Important requirements are missing or only partially supported.
- 0-39: Poor match. Candidate does not fit the core role requirements.

Recommendation rules:
- Use "Apply" only when the score is 75 or higher AND there are no severe missing must-have requirements.
- Use "Apply with Reservations" when the score is between 50 and 74, or when the candidate is promising but has meaningful gaps.
- Use "Do Not Apply" when the score is below 50, or when a critical must-have requirement is missing.

Return ONLY a valid JSON object.
Do not include markdown.
Do not include code fences.
Do not include explanations outside the JSON.
Do not include comments inside the JSON.
Do not include trailing commas.
All strings must use double quotes.
All arrays must contain only strings.
The "score" must be an integer from 0 to 100.
The "recommendation" must be exactly one of:
- "Apply"
- "Apply with Reservations"
- "Do Not Apply"

The JSON object must have exactly this structure and no extra top-level keys:

{
  "score": 75,
  "recommendation": "Apply",
  "matchAnalysis": {
    "matchingSkills": [
      "Skill or requirement from the job description that is supported by the resume"
    ],
    "missingSkills": [
      "Important skill or requirement from the job description that is missing, weak, or unclear in the resume"
    ],
    "experienceFit": "1-2 sentences explaining whether the candidate's experience level, role history, responsibilities, and project scope fit the job.",
    "cultureFit": "1-2 sentences explaining alignment with teamwork, ownership, communication, learning, leadership, startup/corporate environment, or other culture signals from the job description."
  },
  "pros": [
    "Specific evidence-based reason why the candidate fits the role"
  ],
  "cons": [
    "Specific evidence-based gap, risk, or weakness compared to the job description"
  ],
  "details": "One clear paragraph explaining the reasoning behind the score and recommendation. Mention the strongest matches, the most important gaps, and why the final recommendation was chosen.",
  "resumeTips": [
    "Actionable suggestion to tailor the resume better for this specific job"
  ]
}

Content requirements:
- "matchingSkills" should include 3-8 items when possible.
- "missingSkills" should include 2-8 items when possible.
- "pros" should include 2-4 items.
- "cons" should include 2-4 items.
- "resumeTips" should include 2-4 items.
- If there are no meaningful missing skills, return an empty array for "missingSkills".
- If there are no meaningful cons, include minor improvement areas rather than inventing serious gaps.
- Keep each array item concise but specific.
- The "details" field should be honest, direct, and useful to the candidate.

Important:
The output must be machine-parseable JSON.
Return the JSON object only.
`;

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const resume = readRequiredString((body as { resume?: unknown })?.resume, "Resume text", MAX_RESUME_CHARS);
    const job_description = readRequiredString((body as { job_description?: unknown })?.job_description, "Job description", MAX_JOB_DESCRIPTION_CHARS);
    const provider = readProvider((body as { provider?: unknown })?.provider);

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let result_content = "";

    if (provider === "openai") {
      if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt = `
Today's date is ${today}. Use this date to accurately calculate years of experience from dates listed in the resume (e.g., from April 2023 to present).

Candidate's Resume:
\"\"\"
${resume}
\"\"\"

Job Description:
\"\"\"
${job_description}
\"\"\"

Please analyze the resume against the job description and output only the valid JSON result.
`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });
      result_content = response.choices[0].message.content || "{}";

    } else if (provider === "anthropic") {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const prompt = `
Today's date is ${today}. Use this date to accurately calculate years of experience from dates listed in the resume (e.g., from April 2023 to present).

Candidate's Resume:
\"\"\"
${resume}
\"\"\"

Job Description:
\"\"\"
${job_description}
\"\"\"

Please analyze the resume against the job description and output only the valid JSON result.
`;
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: SYSTEM_PROMPT + "\n\nYou MUST return ONLY valid JSON. Do not include markdown formatting or any other text.",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      });
      // @ts-expect-error type mismatches due to anthropic SDK versioning
      result_content = response.content[0].text || "{}";

    } else if (provider === "gemini") {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured in the server environment variables.");
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

      const prompt = `
${SYSTEM_PROMPT}

Today's date is ${today}. Use this date to accurately calculate years of experience from dates listed in the resume (e.g., from April 2023 to present).

Candidate's Resume:
\"\"\"
${resume}
\"\"\"

Job Description:
\"\"\"
${job_description}
\"\"\"

Please analyze the resume against the job description and output only the valid JSON result.
`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }]}],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        }
      });

      result_content = result.response.text().trim();
    } else {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    // Clean up potential markdown formatting wrappers returned by the model
    result_content = result_content.trim();
    if (result_content.startsWith("```json")) result_content = result_content.substring(7);
    if (result_content.startsWith("```")) result_content = result_content.substring(3);
    if (result_content.endsWith("```")) result_content = result_content.slice(0, -3);

    const result_json = JSON.parse(result_content.trim());

    return NextResponse.json(result_json);

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`Error during job checking:`, error);
    return NextResponse.json({ error: error.message || "An error occurred during analysis" }, { status: error instanceof InputError ? 400 : 500 });
  }
}
