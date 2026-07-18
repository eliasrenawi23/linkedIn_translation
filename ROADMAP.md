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
| 8. Interview preparation workspace | Proposed - next |
| 9. Application tracker | Proposed |
| 10. Resume version workspace | Proposed |
| 11. Analysis quality and cost controls | Proposed |
| 12. Private account sync | Future |

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

## Recommended next features

The next phase should turn a strong one-time analysis into a complete application workflow. Features are ordered by user value, fit with the existing architecture, implementation risk, and dependency order.

## Milestone 8 - Interview preparation workspace

Status: Proposed - recommended next implementation

Why this is next:

- The app already has the resume, job requirements, evidence matrix, gaps, and talking points needed to produce grounded interview preparation.
- It adds meaningful value without requiring accounts, a database, or third-party integrations.
- It naturally continues the workflow after a user decides to apply.

Proposed scope:

- Add a dedicated Interview Prep page launched from a completed job analysis.
- Generate likely recruiter, behavioral, technical, and role-specific questions.
- Tie every suggested answer outline to evidence from the submitted resume.
- Generate STAR answer frameworks while clearly marking missing situation, task, action, or result evidence.
- Create a focused gap-defense section for missing or partial must-have requirements.
- Add questions the candidate should ask the recruiter, hiring manager, and future team.
- Let users mark questions as practiced, difficult, or complete during the current browser session.
- Provide copy controls and a print-friendly preparation sheet.

Acceptance criteria:

- Suggested answers never invent employers, projects, metrics, tools, or responsibilities.
- Every answer outline identifies its resume evidence source.
- Weak evidence is labeled as a follow-up prompt instead of being silently completed by AI.
- The page works without storing full resume or job-description text in persistent history.
- Generation is explicit and on demand so it does not increase the normal analysis cost.

Suggested implementation slices:

1. Add validated interview-prep schemas and API generation.
2. Pass the current analysis context through session storage.
3. Build the question categories and evidence-linked answer cards.
4. Add local practice state, copy actions, and print styling.
5. Add validation, API, and UI regression tests.

Suggested commit:

`feat(interview): add evidence-grounded interview preparation workspace`

## Milestone 9 - Application tracker

Status: Proposed

User value:

- Turn saved analyses into an actionable job-search pipeline.
- Help users remember follow-ups, interviews, and outcomes.

Proposed scope:

- Promote a history entry into an application with a status: Interested, Applied, Recruiter Screen, Interviewing, Offer, Rejected, or Withdrawn.
- Store application date, next action, due date, contact name, notes, and source URL.
- Add board and list views with filters for status, favorites, company, and due actions.
- Highlight overdue follow-ups and applications with no activity.
- Export and import versioned tracker data.
- Keep tracker data local-first until account sync is implemented.

Acceptance criteria:

- Existing history files continue to import successfully.
- Tracker migrations are versioned and tested.
- Full resume and job-description bodies are not stored in tracker records.
- Status changes and notes work offline in the browser.

## Milestone 10 - Resume version workspace

Status: Proposed

User value:

- Convert accepted tailoring suggestions into reusable, role-specific resume versions.
- Make it clear which version was used for each application.

Proposed scope:

- Create named resume profiles such as Default, Backend, Full Stack, and Leadership.
- Build a tailored draft from individually accepted summary, skill, and bullet suggestions.
- Show a side-by-side diff against the source resume.
- Preserve evidence links for every changed claim.
- Export the tailored draft as Markdown and plain text first; consider DOCX after the content workflow is stable.
- Attach a resume-version identifier to history and application tracker records.

Acceptance criteria:

- The original resume is always recoverable and never overwritten.
- Unsupported keywords cannot be accepted as resume claims.
- Each generated change retains its source evidence.
- Exported text is readable without application-specific formatting.

## Milestone 11 - Analysis quality and cost controls

Status: Proposed

User value:

- Make AI behavior easier to understand, reproduce, and control.
- Reduce accidental provider spending and improve production reliability.

Proposed scope:

- Show model name, request duration, retry count, and generation timestamp on results.
- Estimate token usage and cost when the provider returns reliable usage metadata.
- Add per-feature provider preferences for analysis, application package, interview prep, and comparison.
- Add configurable spending warnings before multi-model or long-form generation.
- Add deployment-level rate limiting and request correlation IDs.
- Add a privacy-safe diagnostics view that excludes resume and job-description bodies.
- Add an explicit cancel action for long-running UI requests using `AbortController`.

Acceptance criteria:

- Cost labels distinguish exact provider-reported usage from estimates.
- Request cancellation returns the UI to a usable state.
- Logs and diagnostics never expose provider keys, resumes, or full job descriptions.
- Public deployments have documented rate-limit configuration.

## Milestone 12 - Private account sync

Status: Future

Why it is later:

- Authentication and cloud storage materially increase security, privacy, migration, and operational requirements.
- The local-first workflow should be proven before sensitive career data is synchronized.

Possible scope:

- Optional authentication and encrypted server-side storage.
- Sync history, tracker records, resume profiles, and preferences across devices.
- Provide data export, retention controls, account deletion, and session management.
- Keep AI provider credentials server-managed; never store user API keys in browser storage.

Prerequisites:

- A documented privacy and retention model.
- Authorization tests for every stored resource.
- Encryption, audit logging, backups, deletion workflows, and production rate limiting.

## Smaller feature opportunities

These can be delivered between larger milestones when they support the active milestone:

- Saved job-search filters for history and tracker views.
- Print and PDF-friendly layouts for analysis and interview preparation.
- Keyboard shortcuts for analyze, copy, navigate tabs, and open detailed reviews.
- Accessibility improvements including live generation status, skip links, and reduced-motion support.
- A configurable skills taxonomy to merge equivalent names such as React.js and React.
- Duplicate-job detection based on normalized company, title, and source URL.
- Automatic follow-up message drafts based on application stage and elapsed time.
- A user-editable personal evidence library for achievements, metrics, and project stories.

## Recommended delivery order

1. Interview preparation workspace.
2. Application tracker.
3. Resume version workspace.
4. Analysis quality and cost controls.
5. Private account sync only after the local-first product and privacy model are stable.

The immediate next implementation should be Milestone 8, starting with the validated interview-preparation contract and evidence-grounded API response.

## Engineering guardrails

- Treat resumes and imported pages as sensitive, untrusted input.
- Never log resume or job-description bodies.
- Keep provider keys server-only.
- Add deployment-level rate limiting before public launch.
- Do not promise reliable LinkedIn scraping; authenticated or bot-protected pages should fall back to paste mode.
- Configure current provider model identifiers centrally rather than hard-coding them throughout the application.
