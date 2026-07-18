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
| 4. Resume tailoring | Complete |
| 5. Application package | Complete |
| 6. History and comparison | Complete |
| 7. Multi-model review | Complete |

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

Status: Complete

Delivered:

- Generate a role-specific professional summary with supporting resume facts.
- Prioritize skills already evidenced in the resume by relevance to the job.
- Generate evidence-grounded bullet rewrites without changing facts, scope, metrics, technologies, or seniority.
- Show before/after bullet comparisons with individual Copy and Accept controls.
- Preserve the original resume throughout the session; accepting a suggestion only marks it locally.
- Identify attractive job keywords that must not be inserted without supporting evidence.
- Validate every tailoring field at runtime and reject unexpected or incomplete structures.
- Cover unsupported fields and incomplete bullet rewrites with regression tests.

Acceptance criteria:

- Every suggested claim can be traced to original resume text.
- Users can accept suggestions individually.
- Unsupported keywords are identified instead of silently inserted.

## Milestone 5 - Application package

Status: Complete

Delivered:

- Generate a cover letter, recruiter message, connection note, honest company-interest response, and interview talking points.
- Run generation on demand so the normal analysis remains faster and less expensive.
- Reuse the submitted resume, job description, and verified evidence matrix rather than performing a second independent assessment.
- Provide professional, warm, and direct tone controls.
- Provide concise, standard, and detailed length controls.
- Enforce a 280-character connection-note limit.
- Display every output in a dedicated Apply Kit tab with individual copy controls.
- Validate the complete application package at runtime and reject unexpected or incomplete structures.
- Cover valid packages, insufficient talking points, and unexpected fields with regression tests.

## Milestone 6 - History and comparison

Status: Complete

Delivered:

- Automatically save compact analysis summaries in browser localStorage.
- Never store full resume or job-description bodies in history.
- Store job title, company, source URL, score, recommendation, resume version, date, matching and missing skills, critical gaps, and favorite state.
- Keep up to 30 recent entries using versioned, validated storage.
- Add a dedicated History page with favorites and individual deletion.
- Compare two or three selected jobs side by side.
- Export portable, versioned JSON history files.
- Validate and merge imported JSON history files.
- Add regression tests for round trips, unsupported versions, invalid records, and compact storage.

## Milestone 7 - Multi-model review

Status: Complete

Delivered:

- Run two or three configured providers in parallel only when explicitly requested.
- Use a compact comparison contract so the feature does not generate three full tailoring packages.
- Preserve the primary analysis rather than replacing it with an averaged result.
- Show each provider's score, recommendation, summary, matching skills, critical gaps, and latency.
- Compute deterministic average score, score spread, recommendation agreement, majority consensus, and shared findings.
- Preserve successful reviews when another provider fails and display partial failures clearly.
- Reject duplicate selections and require two or three distinct providers.
- Prevent comparisons after the resume or job description changes until the primary analysis is rerun.
- Disclose that every selected model creates an additional paid request; exact cost remains unavailable unless provider pricing and token usage are configured reliably.
- Disable raw comparison-response logging because it may contain resume-derived information.
- Add regression tests for review validation, score spread, shared findings, mixed outcomes, and unanimous recommendations.

This remains opt-in because it increases cost and latency. The core single-model workflow remains the default.

## Engineering guardrails

- Treat resumes and imported pages as sensitive, untrusted input.
- Never log resume or job-description bodies.
- Keep provider keys server-only.
- Add deployment-level rate limiting before public launch.
- Do not promise reliable LinkedIn scraping; authenticated or bot-protected pages should fall back to paste mode.
- Configure current provider model identifiers centrally rather than hard-coding them throughout the application.
