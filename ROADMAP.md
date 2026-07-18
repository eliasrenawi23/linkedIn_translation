# LinkedIn Translator and Job Checker Roadmap

Last updated: July 18, 2026

## Product direction

Build a focused application assistant around one repeatable workflow:

1. Import or paste a job description.
2. Compare it with a verified resume.
3. Explain the match with evidence.
4. Tailor application material without inventing experience.

## Progress

| Milestone | Status |
| --- | --- |
| 1. Reliable job intake | Complete |
| 2. Trustworthy structured analysis | Complete |
| 3. Evidence matrix | Complete |
| 4. Resume tailoring | Next |
| 5. Application package | Planned |
| 6. History and comparison | Planned |
| 7. Multi-model review | Planned |

## Milestone 1 - Reliable job intake

Status: Complete

Delivered:

- Import public job pages by URL.
- Extract page metadata and readable text.
- Keep imported text editable before analysis.
- Reject local/private network URLs, non-HTTP protocols, redirect abuse, oversized responses, and non-HTML responses.
- Apply request, text, and resume-upload size limits.
- Correct the Turbopack project root so local dependencies resolve from this project.

Known limitation:

- Authenticated or bot-protected job sites may prevent importing. Users can paste the job description instead.

## Milestone 2 - Trustworthy structured analysis

Status: Complete

Objective: Make AI results predictable, type-safe, provider-independent, and testable.

Delivered:

- Shared TypeScript contracts and strict runtime validators for translation and job-match results.
- One adapter for OpenAI, Gemini, and Anthropic structured generation.
- Central provider names, model identifiers, environment variables, timeout, and retry settings.
- Shared parsing for plain and markdown-fenced JSON.
- Stable public error codes for invalid input, missing configuration, timeouts, unavailable providers, and malformed responses.
- A 30-second request timeout and one retry for transient provider failures.
- Contract tests for JSON parsing, scores, recommendations, required fields, nested fields, and unexpected fields.
- Passing targeted ESLint, seven automated tests, and the full TypeScript check.

Acceptance criteria:

- Every successful API response matches its runtime schema and TypeScript contract.
- Invalid model JSON never reaches the UI as a successful result.
- Provider-specific request code is not duplicated across feature routes.
- A provider timeout or malformed response produces a consistent, useful error.
- Models and provider settings can be changed in one place.
- Automated tests cover malformed JSON, missing fields, invalid scores, invalid recommendations, and provider failures.

Suggested commit:

`refactor: centralize and validate structured AI responses`

## Milestone 3 - Evidence matrix

Status: Complete

Delivered:

- Return the most important job requirements with importance, resume evidence, match status, and explanation.
- Separate must-have requirements from preferences.
- Classify each requirement as match, partial, missing, or unclear.
- Validate all evidence entries with a strict runtime schema.
- Display a dedicated Evidence tab alongside the overall score.
- Highlight missing must-have requirements as critical gaps.
- Explicitly represent absent evidence instead of inventing candidate experience.
- Cover invalid statuses and empty evidence matrices with regression tests.

Acceptance criteria:

- Every major score deduction points to a visible requirement and evidence gap.
- Users can understand the recommendation without relying on the numeric score alone.

## Milestone 4 - Resume tailoring

Status: Next

- Generate a role-specific summary, skill ordering, and bullet rewrites.
- Only transform facts supported by the original resume.
- Show before/after diffs and allow copying individual suggestions.
- Preserve the original resume throughout the session.

Acceptance criteria:

- Every suggested claim can be traced to original resume text.
- Users can accept suggestions individually.
- Unsupported keywords are identified instead of silently inserted.

## Milestone 5 - Application package

Status: Planned

- Generate a concise cover letter, recruiter message, connection note, and interview talking points.
- Reuse the verified evidence matrix rather than analyzing from scratch.
- Provide tone and length controls.

## Milestone 6 - History and comparison

Status: Planned

- Save recent analyses locally before adding accounts or a database.
- Store job metadata, score, resume version, date, and favorite state.
- Compare several jobs side by side.
- Add export/import so local history is portable.

## Milestone 7 - Multi-model review

Status: Planned

- Run selected providers in parallel when explicitly requested.
- Show agreements and meaningful disagreements.
- Track latency and estimated cost.

This is intentionally last because it increases cost and latency without improving the core workflow as much as reliable intake, evidence, and tailoring.

## Engineering guardrails

- Treat resumes and imported pages as sensitive, untrusted input.
- Never log resume or job-description bodies.
- Keep provider keys server-only.
- Add deployment-level rate limiting before public launch.
- Do not promise reliable LinkedIn scraping; authenticated or bot-protected pages should fall back to paste mode.
- Configure current provider model identifiers centrally rather than hard-coding them throughout the application.
