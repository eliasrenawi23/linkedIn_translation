export const MODEL_REVIEW_CONTEXT_KEY = "career-suite:model-review-context";

export interface ModelReviewContext {
  resume: string;
  jobDescription: string;
  jobTitle: string;
  company: string;
  primaryScore: number;
  primaryRecommendation: string;
  preparedAt: string;
}

export interface ModelComparisonResult {
  reviews: Array<{
    provider: "gemini" | "openai" | "anthropic";
    score: number;
    recommendation: "Apply" | "Apply with Reservations" | "Do Not Apply";
    matchingSkills: string[];
    missingSkills: string[];
    criticalGaps: string[];
    summary: string;
    latencyMs: number;
  }>;
  failures: Array<{ provider: string; error: string; providerResponse?: unknown }>;
  consensus: {
    averageScore: number;
    scoreSpread: number;
    recommendationAgreement: boolean;
    consensusRecommendation: "Apply" | "Apply with Reservations" | "Do Not Apply" | "Mixed";
    sharedMatchingSkills: string[];
    sharedMissingSkills: string[];
  };
  providerNames: Record<string, string>;
}
