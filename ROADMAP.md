# LinkedIn Translator and Job Checker Roadmap

## Product direction

Build a focused application assistant around one repeatable workflow:

1. Import or paste a job description.
2. Compare it with a verified resume.
3. Explain the match with evidence.
4. Tailor application material without inventing experience.

## Milestone 1 — Reliable job intake (implemented)

- Import public job pages by URL.
- Extract useful page metadata and readable text.
- Keep imported text editable and require user review before analysis.
- Reject local/private network URLs, non-HTTP protocols, redirect abuse, oversized responses, and non-HTML responses.
- Apply request, text, and upload size limits to existing endpoints.

Acceptance criteria:

- A public HTTP(S) job page can populate the job-description field.
- A failed import produces a useful message without erasing existing text.
- `localhost`, private IP ranges, credentials in URLs, and oversized pages are rejected.
- Resume and job-analysis requests reject empty or unreasonably large inputs.

## Milestone 2 — Trustworthy structured analysis

- Move provider calls behind a shared adapter.
- Define runtime schemas for translation and job-match responses.
- Normalize scores and recommendations and reject malformed model responses.
- Add provider timeouts, retry policy, and stable public error codes.
- Add unit tests for validation and provider response parsing.

Acceptance criteria:

- Every successful API response matches its TypeScript contract.
- Invalid model JSON never reaches the UI as a successful result.
- Provider-specific code is not duplicated across feature routes.

## Milestone 3 — Evidence matrix

- Return each important job requirement with importance, resume evidence, and match status.
- Separate must-have requirements from preferences.
- Display the matrix alongside the overall score.
- Flag claims that need confirmation from the candidate.

Acceptance criteria:

- Every major score deduction points to a visible requirement and evidence gap.
- Users can understand the recommendation without relying on the numeric score alone.

## Milestone 4 — Resume tailoring

- Generate a role-specific summary, skill ordering, and bullet rewrites.
- Only transform facts supported by the original resume.
- Show before/after diffs and allow copying individual suggestions.
- Preserve the original resume throughout the session.

Acceptance criteria:

- Every suggested claim can be traced to original resume text.
- Users can accept suggestions individually.
- The feature explicitly marks unsupported keywords instead of inserting them.

## Milestone 5 — Application package

- Generate a concise cover letter, recruiter message, connection note, and interview talking points.
- Reuse the verified evidence matrix rather than analyzing from scratch.
- Provide tone and length controls.

## Milestone 6 — History and comparison

- Save recent analyses locally before adding accounts or a database.
- Store job metadata, score, resume version, date, and favorite state.
- Compare several jobs side by side.
- Add export/import so local history is portable.

## Milestone 7 — Multi-model review

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
- Verify current provider model identifiers through configuration rather than hard-coding them throughout the application.
