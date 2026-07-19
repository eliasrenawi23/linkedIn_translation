import assert from "node:assert/strict";
import test from "node:test";
import { parseStructuredJson, StructuredJsonError } from "../app/lib/ai/json.ts";
import { SchemaValidationError, aggregateModelReviews, validateApplicationPackage, validateCandidateEvaluation, validateJobMatchResult, validateModelReview, validateTranslationResult } from "../app/lib/ai/schemas.ts";
import { JOB_HISTORY_STORAGE_KEY, createHistoryExport, loadJobHistory, parseHistoryImport, upsertJobHistory } from "../app/lib/job-history.ts";

test("parseStructuredJson accepts plain and fenced JSON", () => {
  assert.deepEqual(parseStructuredJson('{"score": 10}'), { score: 10 });
  assert.deepEqual(parseStructuredJson('```json\n{"score": 20}\n```'), { score: 20 });
});

test("parseStructuredJson extracts JSON surrounded by provider prose", () => {
  assert.deepEqual(
    parseStructuredJson('Here is the result:\n{"details":"A brace } inside a string","score": 80}\nHope this helps.'),
    { details: "A brace } inside a string", score: 80 },
  );
});

test("parseStructuredJson rejects truncated JSON", () => {
  assert.throws(() => parseStructuredJson('{"score": 80'), StructuredJsonError);
});

test("parseStructuredJson rejects malformed data with a stable error", () => {
  assert.throws(() => parseStructuredJson("not json"), StructuredJsonError);
});

test("translation validation normalizes whitespace", () => {
  assert.deepEqual(validateTranslationResult({ headline: "  Core  ", translation: " Truth ", score: 55 }), {
    headline: "Core",
    translation: "Truth",
    score: 55,
  });
});

test("translation validation rejects invalid scores and extra fields", () => {
  assert.throws(() => validateTranslationResult({ headline: "A", translation: "B", score: 101 }), SchemaValidationError);
  assert.throws(() => validateTranslationResult({ headline: "A", translation: "B", score: 10, extra: true }), SchemaValidationError);
});

const validJobMatch = {
  score: 75,
  recommendation: "Apply",
  matchAnalysis: {
    matchingSkills: ["TypeScript"],
    missingSkills: [],
    experienceFit: "Relevant experience.",
    cultureFit: "Evidence of ownership.",
  },
  requirements: [{
    requirement: "TypeScript",
    importance: "must-have",
    status: "match",
    resumeEvidence: "Built TypeScript services.",
    explanation: "The resume contains direct evidence.",
  }],
  resumeTailoring: {
    summary: {
      suggested: "TypeScript developer with experience building services.",
      evidenceSources: ["Built TypeScript services."],
    },
    prioritizedSkills: ["TypeScript"],
    bulletRewrites: [{
      original: "Built services with TypeScript.",
      suggested: "Built TypeScript services for production workflows.",
      evidenceSource: "Built services with TypeScript.",
    }],
    unsupportedKeywords: ["Kubernetes"],
  },
  pros: ["Strong core stack"],
  cons: ["Limited domain evidence"],
  details: "The core requirements are supported.",
  resumeTips: ["Quantify project outcomes"],
};

test("job match validation accepts the documented contract", () => {
  assert.deepEqual(validateJobMatchResult(validJobMatch), validJobMatch);
});

test("job match validation rejects unsupported recommendations", () => {
  assert.throws(() => validateJobMatchResult({ ...validJobMatch, recommendation: "Maybe" }), SchemaValidationError);
});

test("job match validation rejects missing nested fields", () => {
  assert.throws(() => validateJobMatchResult({ ...validJobMatch, matchAnalysis: { matchingSkills: [] } }), SchemaValidationError);
});

test("job match validation rejects invalid evidence status", () => {
  assert.throws(() => validateJobMatchResult({
    ...validJobMatch,
    requirements: [{ ...validJobMatch.requirements[0], status: "mostly" }],
  }), SchemaValidationError);
});

test("job match validation requires at least one evidence entry", () => {
  assert.throws(() => validateJobMatchResult({ ...validJobMatch, requirements: [] }), SchemaValidationError);
});

test("job match validation rejects invented tailoring fields", () => {
  assert.throws(() => validateJobMatchResult({
    ...validJobMatch,
    resumeTailoring: { ...validJobMatch.resumeTailoring, inventedMetric: "50%" },
  }), SchemaValidationError);
});

test("job match validation rejects incomplete bullet rewrites", () => {
  assert.throws(() => validateJobMatchResult({
    ...validJobMatch,
    resumeTailoring: {
      ...validJobMatch.resumeTailoring,
      bulletRewrites: [{ original: "Built services." }],
    },
  }), SchemaValidationError);
});

const validApplicationPackage = {
  coverLetter: "A concise, evidence-based cover letter.",
  recruiterMessage: "A recruiter message.",
  connectionNote: "A short connection note.",
  whyThisCompany: "The role aligns with the supplied experience.",
  interviewTalkingPoints: ["TypeScript project", "Relevant ownership", "Team collaboration"],
};

test("application package validation accepts the documented contract", () => {
  assert.deepEqual(validateApplicationPackage(validApplicationPackage), validApplicationPackage);
});

test("application package validation rejects too few talking points", () => {
  assert.throws(() => validateApplicationPackage({ ...validApplicationPackage, interviewTalkingPoints: ["Only one"] }), SchemaValidationError);
});

test("application package validation rejects unexpected fields", () => {
  assert.throws(() => validateApplicationPackage({ ...validApplicationPackage, inventedClaim: "No" }), SchemaValidationError);
});

const historyEntry = {
  id: "entry-1",
  createdAt: "2026-07-18T12:00:00.000Z",
  title: "Software Engineer",
  company: "Example Company",
  sourceUrl: "https://example.com/jobs/1",
  score: 82,
  recommendation: "Apply" as const,
  resumeVersion: "Default resume",
  matchingSkills: ["TypeScript"],
  missingSkills: ["Kubernetes"],
  criticalGaps: [],
  favorite: false,
};

test("history export round-trips valid compact entries", () => {
  assert.deepEqual(parseHistoryImport(createHistoryExport([historyEntry])), [historyEntry]);
});

test("history import rejects unsupported versions", () => {
  assert.throws(() => parseHistoryImport({ version: 2, entries: [] }));
});

test("history storage saves compact summaries and ignores invalid data", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  upsertJobHistory(storage, historyEntry);
  values.set(JOB_HISTORY_STORAGE_KEY, JSON.stringify([...loadJobHistory(storage), { score: 999 }]));
  assert.deepEqual(loadJobHistory(storage), [historyEntry]);
  assert.equal(values.get(JOB_HISTORY_STORAGE_KEY)?.includes("resumeText"), false);
});

const geminiReview = validateModelReview({
  score: 80,
  recommendation: "Apply",
  matchingSkills: ["TypeScript", "React"],
  missingSkills: ["Kubernetes"],
  criticalGaps: [],
  summary: "Strong core match.",
}, "gemini", 1200);

const openAiReview = validateModelReview({
  score: 70,
  recommendation: "Apply with Reservations",
  matchingSkills: ["typescript", "Node.js"],
  missingSkills: ["kubernetes"],
  criticalGaps: ["Cloud certification"],
  summary: "A meaningful gap remains.",
}, "openai", 900);

test("model review validation rejects invalid fields", () => {
  assert.throws(() => validateModelReview({ score: 105 }, "gemini", 10), SchemaValidationError);
});

test("model consensus calculates spread and shared findings", () => {
  const consensus = aggregateModelReviews([geminiReview, openAiReview]);
  assert.equal(consensus.averageScore, 75);
  assert.equal(consensus.scoreSpread, 10);
  assert.equal(consensus.consensusRecommendation, "Mixed");
  assert.deepEqual(consensus.sharedMatchingSkills, ["TypeScript"]);
  assert.deepEqual(consensus.sharedMissingSkills, ["Kubernetes"]);
});

test("model consensus reports unanimous recommendation", () => {
  const consensus = aggregateModelReviews([geminiReview, { ...openAiReview, recommendation: "Apply", score: 78 }]);
  assert.equal(consensus.recommendationAgreement, true);
  assert.equal(consensus.consensusRecommendation, "Apply");
});

test("candidate evaluation validates category limits and calculates the overall score", () => {
  const result = validateCandidateEvaluation({
    scores: {
      openSource: { score: 20, max: 35, evidence: "Verified external contributions" },
      selfProjects: { score: 24, max: 30, evidence: "Two complex deployed projects" },
      production: { score: 18, max: 25, evidence: "Production engineering experience" },
      technicalSkills: { score: 8, max: 10, evidence: "Evidenced technical breadth" },
    },
    bonusPoints: { total: 4, breakdown: "Technical writing and adoption" },
    deductions: { total: 2, reasons: "One project lacks a link" },
    keyStrengths: ["Strong project execution"],
    areasForImprovement: ["Document external contributions"],
  });
  assert.equal(result.overallScore, 72);
  assert.equal(result.githubEnriched, false);
});

test("candidate evaluation rejects scores above the source rubric limits", () => {
  assert.throws(() => validateCandidateEvaluation({
    scores: {
      openSource: { score: 36, max: 35, evidence: "Invalid" },
      selfProjects: { score: 20, max: 30, evidence: "Evidence" },
      production: { score: 20, max: 25, evidence: "Evidence" },
      technicalSkills: { score: 8, max: 10, evidence: "Evidence" },
    },
    bonusPoints: { total: 0, breakdown: "None" },
    deductions: { total: 0, reasons: "None" },
    keyStrengths: ["Strength"],
    areasForImprovement: ["Improvement"],
  }), SchemaValidationError);
});
