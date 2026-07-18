import assert from "node:assert/strict";
import test from "node:test";
import { parseStructuredJson, StructuredJsonError } from "../app/lib/ai/json.ts";
import { SchemaValidationError, validateApplicationPackage, validateJobMatchResult, validateTranslationResult } from "../app/lib/ai/schemas.ts";

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
