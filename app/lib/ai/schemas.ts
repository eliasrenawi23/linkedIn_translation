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

export type ResumeTailoring = {
  summary: {
    suggested: string;
    evidenceSources: string[];
  };
  prioritizedSkills: string[];
  bulletRewrites: Array<{
    original: string;
    suggested: string;
    evidenceSource: string;
  }>;
  unsupportedKeywords: string[];
};

export type ApplicationPackage = {
  coverLetter: string;
  recruiterMessage: string;
  connectionNote: string;
  whyThisCompany: string;
  interviewTalkingPoints: string[];
};

export type ModelReview = {
  provider: "gemini" | "openai" | "anthropic";
  score: number;
  recommendation: JobMatchRecommendation;
  matchingSkills: string[];
  missingSkills: string[];
  criticalGaps: string[];
  summary: string;
  latencyMs: number;
};

export type ModelReviewConsensus = {
  averageScore: number;
  scoreSpread: number;
  recommendationAgreement: boolean;
  consensusRecommendation: JobMatchRecommendation | "Mixed";
  sharedMatchingSkills: string[];
  sharedMissingSkills: string[];
};

export type CandidateCategoryScore = {
  score: number;
  max: number;
  evidence: string;
};

export type CandidateEvaluation = {
  scores: {
    openSource: CandidateCategoryScore;
    selfProjects: CandidateCategoryScore;
    production: CandidateCategoryScore;
    technicalSkills: CandidateCategoryScore;
  };
  bonusPoints: { total: number; breakdown: string };
  deductions: { total: number; reasons: string };
  keyStrengths: string[];
  areasForImprovement: string[];
  overallScore: number;
  githubEnriched: boolean;
};

export type StructuredCandidateProfile = {
  summary: string;
  profiles: Array<{ network: string; url: string; username: string }>;
  work: Array<{ company: string; position: string; startDate: string; endDate: string; summary: string; highlights: string[] }>;
  skills: Array<{ category: string; keywords: string[] }>;
  projects: Array<{ name: string; description: string; url: string; technologies: string[] }>;
  awards: Array<{ title: string; date: string; awarder: string }>;
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
  resumeTailoring: ResumeTailoring;
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

function boundedNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new SchemaValidationError(`${path} must be a number from ${minimum} to ${maximum}`);
  }
  return Math.round(value * 10) / 10;
}

function candidateCategory(value: unknown, path: string, expectedMax: number): CandidateCategoryScore {
  const category = object(value, path);
  exactKeys(category, ["score", "max", "evidence"], path);
  if (category.max !== expectedMax) throw new SchemaValidationError(`${path}.max must be ${expectedMax}`);
  return {
    score: boundedNumber(category.score, `${path}.score`, 0, expectedMax),
    max: expectedMax,
    evidence: string(category.evidence, `${path}.evidence`),
  };
}

export function validateCandidateEvaluation(value: unknown): CandidateEvaluation {
  const result = object(value, "candidate evaluation");
  exactKeys(result, ["scores", "bonusPoints", "deductions", "keyStrengths", "areasForImprovement"], "candidate evaluation");
  const scores = object(result.scores, "scores");
  
  // Sanitize scores by filtering out any unexpected keys that the LLM may have generated (like technicalSkillsMax)
  const expectedScoreKeys = ["openSource", "selfProjects", "production", "technicalSkills"];
  for (const key of Object.keys(scores)) {
    if (!expectedScoreKeys.includes(key)) {
      delete scores[key];
    }
  }

  exactKeys(scores, expectedScoreKeys, "scores");
  const bonus = object(result.bonusPoints, "bonusPoints");
  exactKeys(bonus, ["total", "breakdown"], "bonusPoints");
  const deductions = object(result.deductions, "deductions");
  exactKeys(deductions, ["total", "reasons"], "deductions");
  const parsedScores = {
    openSource: candidateCategory(scores.openSource, "scores.openSource", 35),
    selfProjects: candidateCategory(scores.selfProjects, "scores.selfProjects", 30),
    production: candidateCategory(scores.production, "scores.production", 25),
    technicalSkills: candidateCategory(scores.technicalSkills, "scores.technicalSkills", 10),
  };
  const bonusPoints = { total: boundedNumber(bonus.total, "bonusPoints.total", 0, 20), breakdown: string(bonus.breakdown, "bonusPoints.breakdown") };
  const parsedDeductions = { total: boundedNumber(deductions.total, "deductions.total", 0, 50), reasons: string(deductions.reasons, "deductions.reasons") };
  const keyStrengths = stringArray(result.keyStrengths, "keyStrengths", 5);
  const areasForImprovement = stringArray(result.areasForImprovement, "areasForImprovement", 5);
  if (!keyStrengths.length || !areasForImprovement.length) throw new SchemaValidationError("strengths and improvement areas cannot be empty");
  const categoryTotal = Object.values(parsedScores).reduce((total, category) => total + category.score, 0);
  return {
    scores: parsedScores,
    bonusPoints,
    deductions: parsedDeductions,
    keyStrengths,
    areasForImprovement,
    overallScore: Math.max(-20, Math.min(120, Math.round((categoryTotal + bonusPoints.total - parsedDeductions.total) * 10) / 10)),
    githubEnriched: false,
  };
}

export function validateStructuredCandidateProfile(value: unknown): StructuredCandidateProfile {
  const result = object(value, "structured candidate profile");
  exactKeys(result, ["summary", "profiles", "work", "skills", "projects", "awards"], "structured candidate profile");
  const array = (input: unknown, path: string, max: number): unknown[] => {
    if (!Array.isArray(input) || input.length > max) throw new SchemaValidationError(`${path} must be an array with at most ${max} items`);
    return input;
  };
  const optionalString = (input: unknown, path: string): string => {
    if (input === null || input === undefined || input === "") return "Not provided";
    return string(input, path);
  };
  return {
    summary: optionalString(result.summary, "summary"),
    profiles: array(result.profiles, "profiles", 12).map((entry, index) => {
      const path = `profiles[${index}]`; const item = object(entry, path);
      exactKeys(item, ["network", "url", "username"], path);
      return { network: optionalString(item.network, `${path}.network`), url: optionalString(item.url, `${path}.url`), username: optionalString(item.username, `${path}.username`) };
    }),
    work: array(result.work, "work", 20).map((entry, index) => {
      const path = `work[${index}]`; const item = object(entry, path);
      exactKeys(item, ["company", "position", "startDate", "endDate", "summary", "highlights"], path);
      return { company: optionalString(item.company, `${path}.company`), position: optionalString(item.position, `${path}.position`), startDate: optionalString(item.startDate, `${path}.startDate`), endDate: optionalString(item.endDate, `${path}.endDate`), summary: optionalString(item.summary, `${path}.summary`), highlights: stringArray(item.highlights, `${path}.highlights`, 12) };
    }),
    skills: array(result.skills, "skills", 20).map((entry, index) => {
      const path = `skills[${index}]`; const item = object(entry, path);
      exactKeys(item, ["category", "keywords"], path);
      return { category: optionalString(item.category, `${path}.category`), keywords: stringArray(item.keywords, `${path}.keywords`, 30) };
    }),
    projects: array(result.projects, "projects", 30).map((entry, index) => {
      const path = `projects[${index}]`; const item = object(entry, path);
      exactKeys(item, ["name", "description", "url", "technologies"], path);
      return { name: optionalString(item.name, `${path}.name`), description: optionalString(item.description, `${path}.description`), url: optionalString(item.url, `${path}.url`), technologies: stringArray(item.technologies, `${path}.technologies`, 20) };
    }),
    awards: array(result.awards, "awards", 15).map((entry, index) => {
      const path = `awards[${index}]`; const item = object(entry, path);
      exactKeys(item, ["title", "date", "awarder"], path);
      return { title: optionalString(item.title, `${path}.title`), date: optionalString(item.date, `${path}.date`), awarder: optionalString(item.awarder, `${path}.awarder`) };
    }),
  };
}

export function validateRequirementEvidence(value: unknown): RequirementEvidence[] {
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

export function validateApplicationPackage(value: unknown): ApplicationPackage {
  const result = object(value, "application package");
  exactKeys(result, ["coverLetter", "recruiterMessage", "connectionNote", "whyThisCompany", "interviewTalkingPoints"], "application package");
  const talkingPoints = stringArray(result.interviewTalkingPoints, "interviewTalkingPoints", 8);
  if (talkingPoints.length < 3) throw new SchemaValidationError("interviewTalkingPoints must contain at least 3 items");
  return {
    coverLetter: string(result.coverLetter, "coverLetter"),
    recruiterMessage: string(result.recruiterMessage, "recruiterMessage"),
    connectionNote: string(result.connectionNote, "connectionNote"),
    whyThisCompany: string(result.whyThisCompany, "whyThisCompany"),
    interviewTalkingPoints: talkingPoints,
  };
}

export function validateModelReview(value: unknown, provider: ModelReview["provider"], latencyMs: number): ModelReview {
  const result = object(value, "model review");
  exactKeys(result, ["score", "recommendation", "matchingSkills", "missingSkills", "criticalGaps", "summary"], "model review");
  const recommendation = string(result.recommendation, "recommendation");
  if (recommendation !== "Apply" && recommendation !== "Apply with Reservations" && recommendation !== "Do Not Apply") {
    throw new SchemaValidationError("recommendation is invalid");
  }
  return {
    provider,
    score: score(result.score),
    recommendation,
    matchingSkills: stringArray(result.matchingSkills, "matchingSkills"),
    missingSkills: stringArray(result.missingSkills, "missingSkills"),
    criticalGaps: stringArray(result.criticalGaps, "criticalGaps"),
    summary: string(result.summary, "summary"),
    latencyMs: Math.max(0, Math.round(latencyMs)),
  };
}

function sharedStrings(collections: string[][]): string[] {
  if (!collections.length) return [];
  const first = collections[0];
  return first.filter((item, index) => {
    const normalized = item.toLocaleLowerCase();
    return first.findIndex((candidate) => candidate.toLocaleLowerCase() === normalized) === index
      && collections.slice(1).every((collection) => collection.some((candidate) => candidate.toLocaleLowerCase() === normalized));
  });
}

export function aggregateModelReviews(reviews: ModelReview[]): ModelReviewConsensus {
  if (!reviews.length) throw new SchemaValidationError("At least one model review is required");
  const scores = reviews.map((review) => review.score);
  const recommendations = reviews.map((review) => review.recommendation);
  const recommendationAgreement = recommendations.every((recommendation) => recommendation === recommendations[0]);
  const counts = new Map<JobMatchRecommendation, number>();
  recommendations.forEach((recommendation) => counts.set(recommendation, (counts.get(recommendation) ?? 0) + 1));
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const consensusRecommendation = recommendationAgreement || (ordered[0]?.[1] ?? 0) > reviews.length / 2 ? ordered[0][0] : "Mixed";
  return {
    averageScore: Math.round(scores.reduce((total, value) => total + value, 0) / scores.length),
    scoreSpread: Math.max(...scores) - Math.min(...scores),
    recommendationAgreement,
    consensusRecommendation,
    sharedMatchingSkills: sharedStrings(reviews.map((review) => review.matchingSkills)),
    sharedMissingSkills: sharedStrings(reviews.map((review) => review.missingSkills)),
  };
}

function resumeTailoring(value: unknown): ResumeTailoring {
  const tailoring = object(value, "resumeTailoring");
  exactKeys(tailoring, ["summary", "prioritizedSkills", "bulletRewrites", "unsupportedKeywords"], "resumeTailoring");
  const summary = object(tailoring.summary, "resumeTailoring.summary");
  exactKeys(summary, ["suggested", "evidenceSources"], "resumeTailoring.summary");

  if (!Array.isArray(tailoring.bulletRewrites) || tailoring.bulletRewrites.length > 6) {
    throw new SchemaValidationError("resumeTailoring.bulletRewrites must contain at most 6 entries");
  }
  const bulletRewrites = tailoring.bulletRewrites.map((entry, index) => {
    const path = `resumeTailoring.bulletRewrites[${index}]`;
    const rewrite = object(entry, path);
    exactKeys(rewrite, ["original", "suggested", "evidenceSource"], path);
    return {
      original: string(rewrite.original, `${path}.original`),
      suggested: string(rewrite.suggested, `${path}.suggested`),
      evidenceSource: string(rewrite.evidenceSource, `${path}.evidenceSource`),
    };
  });

  return {
    summary: {
      suggested: string(summary.suggested, "resumeTailoring.summary.suggested"),
      evidenceSources: stringArray(summary.evidenceSources, "resumeTailoring.summary.evidenceSources", 6),
    },
    prioritizedSkills: stringArray(tailoring.prioritizedSkills, "resumeTailoring.prioritizedSkills", 16),
    bulletRewrites,
    unsupportedKeywords: stringArray(tailoring.unsupportedKeywords, "resumeTailoring.unsupportedKeywords", 16),
  };
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
  exactKeys(result, ["score", "recommendation", "matchAnalysis", "requirements", "resumeTailoring", "pros", "cons", "details", "resumeTips"], "job match result");
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
    requirements: validateRequirementEvidence(result.requirements),
    resumeTailoring: resumeTailoring(result.resumeTailoring),
    pros: stringArray(result.pros, "pros"),
    cons: stringArray(result.cons, "cons"),
    details: string(result.details, "details"),
    resumeTips: stringArray(result.resumeTips, "resumeTips"),
  };
}
