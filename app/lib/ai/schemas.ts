export type TranslationResult = {
  headline: string;
  translation: string;
  score: number;
};

export type JobMatchRecommendation = "Apply" | "Apply with Reservations" | "Do Not Apply";
export type RequirementImportance = "must-have" | "preferred";
export type RequirementStatus = "match" | "partial" | "missing" | "unclear";

export type RequirementEvidence = {
  requirement: string;
  importance: RequirementImportance;
  status: RequirementStatus;
  resumeEvidence: string;
  explanation: string;
};

export type JobMatchResult = {
  score: number;
  recommendation: JobMatchRecommendation;
  matchAnalysis: {
    matchingSkills: string[];
    missingSkills: string[];
    experienceFit: string;
    cultureFit: string;
  };
  requirements: RequirementEvidence[];
  pros: string[];
  cons: string[];
  details: string;
  resumeTips: string[];
};

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SchemaValidationError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new SchemaValidationError(`${path} has unexpected or missing fields`);
  }
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new SchemaValidationError(`${path} must be a non-empty string`);
  return value.trim();
}

function score(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new SchemaValidationError("score must be an integer from 0 to 100");
  }
  return value;
}

function stringArray(value: unknown, path: string, maxItems = 12): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new SchemaValidationError(`${path} must be a string array with at most ${maxItems} items`);
  return value.map((item, index) => string(item, `${path}[${index}]`));
}

function requirementArray(value: unknown): RequirementEvidence[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new SchemaValidationError("requirements must contain between 1 and 20 entries");
  }

  return value.map((entry, index) => {
    const path = `requirements[${index}]`;
    const requirement = object(entry, path);
    exactKeys(requirement, ["requirement", "importance", "status", "resumeEvidence", "explanation"], path);
    const importance = string(requirement.importance, `${path}.importance`);
    const status = string(requirement.status, `${path}.status`);
    if (importance !== "must-have" && importance !== "preferred") {
      throw new SchemaValidationError(`${path}.importance is invalid`);
    }
    if (status !== "match" && status !== "partial" && status !== "missing" && status !== "unclear") {
      throw new SchemaValidationError(`${path}.status is invalid`);
    }
    return {
      requirement: string(requirement.requirement, `${path}.requirement`),
      importance,
      status,
      resumeEvidence: string(requirement.resumeEvidence, `${path}.resumeEvidence`),
      explanation: string(requirement.explanation, `${path}.explanation`),
    };
  });
}

export function validateTranslationResult(value: unknown): TranslationResult {
  const result = object(value, "translation result");
  exactKeys(result, ["headline", "translation", "score"], "translation result");
  return {
    headline: string(result.headline, "headline"),
    translation: string(result.translation, "translation"),
    score: score(result.score),
  };
}

export function validateJobMatchResult(value: unknown): JobMatchResult {
  const result = object(value, "job match result");
  exactKeys(result, ["score", "recommendation", "matchAnalysis", "requirements", "pros", "cons", "details", "resumeTips"], "job match result");
  const analysis = object(result.matchAnalysis, "matchAnalysis");
  exactKeys(analysis, ["matchingSkills", "missingSkills", "experienceFit", "cultureFit"], "matchAnalysis");

  const recommendation = string(result.recommendation, "recommendation");
  if (recommendation !== "Apply" && recommendation !== "Apply with Reservations" && recommendation !== "Do Not Apply") {
    throw new SchemaValidationError("recommendation is invalid");
  }

  return {
    score: score(result.score),
    recommendation,
    matchAnalysis: {
      matchingSkills: stringArray(analysis.matchingSkills, "matchAnalysis.matchingSkills"),
      missingSkills: stringArray(analysis.missingSkills, "matchAnalysis.missingSkills"),
      experienceFit: string(analysis.experienceFit, "matchAnalysis.experienceFit"),
      cultureFit: string(analysis.cultureFit, "matchAnalysis.cultureFit"),
    },
    requirements: requirementArray(result.requirements),
    pros: stringArray(result.pros, "pros"),
    cons: stringArray(result.cons, "cons"),
    details: string(result.details, "details"),
    resumeTips: stringArray(result.resumeTips, "resumeTips"),
  };
}
