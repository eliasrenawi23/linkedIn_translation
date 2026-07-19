import { NextResponse } from "next/server";
import { generateStructured } from "@/app/lib/ai/provider";
import { aiRouteError, validateAiOutput } from "@/app/lib/ai/http";
import { validateCandidateEvaluation, validateStructuredCandidateProfile } from "@/app/lib/ai/schemas";
import { MAX_RESUME_CHARS, readProvider, readRequiredString, InputError } from "@/app/lib/input-validation";
import { experienceDurationSummary } from "@/app/lib/ai/date-context";

const EXTRACTION_PROMPT = `Extract a structured technical profile from the supplied resume. This stage adapts the section extraction approach from HackerRank Hiring Agent.

Rules:
- Copy only explicitly supported facts. Never infer links, technologies, employers, dates, or achievements.
- Exclude the candidate's name, email, phone, location, school names, and grades because they are not needed for technical scoring.
- Preserve work achievements and metrics exactly as stated.
- Extract only explicit profile URLs. Use "Not provided" for a missing scalar string and [] for a missing collection.
- Normalize dates when clear; otherwise preserve the source wording.

Return only JSON with exactly this structure:
{"summary":"...","profiles":[{"network":"...","url":"...","username":"..."}],"work":[{"company":"...","position":"...","startDate":"...","endDate":"...","summary":"...","highlights":["..."]}],"skills":[{"category":"...","keywords":["..."]}],"projects":[{"name":"...","description":"...","url":"...","technologies":["..."]}],"awards":[{"title":"...","date":"...","awarder":"..."}]}`;

const EVALUATION_PROMPT = `You are an evidence-based technical portfolio evaluator. This rubric is adapted from HackerRank's MIT-licensed Hiring Agent project.

Fairness rules:
- Ignore name, gender, age, demographic information, school names, grades, geography, photos, and other protected or irrelevant characteristics.
- Score only evidence in the structured candidate profile and optional verified GitHub summary.
- Never invent contributions, users, metrics, production use, links, skills, or experience.
- Personal repositories are not contributions to other open-source projects.
- GitHub repositories classified as open_source require multiple contributors and at least 4 commits attributed to the candidate.
- If evidence is absent or unverifiable, score conservatively and say so.
- This is a portfolio-development signal, not a hiring decision.

Score exactly four categories:
- openSource: 0-35. Reward verified contributions to other projects and meaningful community involvement. Personal repos alone must score 10 or less.
- selfProjects: 0-30. Reward complexity, originality, real-world impact, working links, architecture, and adoption. Penalize tutorial-only/basic CRUD portfolios.
- production: 0-25. Reward evidenced professional, internship, volunteer, founder, or production experience.
- technicalSkills: 0-10. Reward evidenced breadth, depth, problem solving, and technical communication.

Bonus is 0-20 for exceptional verified signals. Deductions are positive points subtracted for unsupported claims, unverifiable projects, tutorial-only work, or missing project links. Do not double-penalize the same weakness.

Return only JSON with exactly this structure:
{"scores":{"openSource":{"score":0,"max":35,"evidence":"..."},"selfProjects":{"score":0,"max":30,"evidence":"..."},"production":{"score":0,"max":25,"evidence":"..."},"technicalSkills":{"score":0,"max":10,"evidence":"..."}},"bonusPoints":{"total":0,"breakdown":"..."},"deductions":{"total":0,"reasons":"..."},"keyStrengths":["..."],"areasForImprovement":["..."]}

Use 1-5 concise strengths and 1-5 concrete improvement areas. Do not add fields.`;

type GitHubRepo = {
  name: string; description: string | null; html_url: string; homepage: string | null; language: string | null;
  stargazers_count: number; forks_count: number; fork: boolean; archived: boolean; topics?: string[];
  updated_at: string; open_issues_count: number; size: number;
};

function githubUsername(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new InputError("GitHub username must be text");
  const normalized = value.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").split(/[\/?#]/)[0];
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(normalized)) throw new InputError("Enter a valid GitHub username or profile URL");
  return normalized;
}

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/vnd.github+json", "User-Agent": "LinkedIn-Career-Suite", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function githubFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try { return await fetch(url, { headers: githubHeaders(), signal: controller.signal, cache: "no-store" }); }
  finally { clearTimeout(timeout); }
}

async function contributorEvidence(username: string, repo: GitHubRepo) {
  const response = await githubFetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/contributors?per_page=100`);
  const contributors = response.ok ? await response.json() as Array<{ login?: string; contributions?: number }> : [];
  const authorCommits = contributors.find((contributor) => contributor.login?.toLowerCase() === username.toLowerCase())?.contributions ?? 0;
  const totalCommits = contributors.reduce((total, contributor) => total + (contributor.contributions ?? 0), 0);
  return {
    name: repo.name,
    description: repo.description,
    githubUrl: repo.html_url,
    liveUrl: repo.homepage || null,
    language: repo.language,
    topics: repo.topics?.slice(0, 8) ?? [],
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    isFork: repo.fork,
    openIssues: repo.open_issues_count,
    size: repo.size,
    updatedAt: repo.updated_at,
    contributorCount: contributors.length,
    authorCommitCount: authorCommits,
    totalCommitCount: totalCommits,
    projectType: contributors.length > 1 ? "open_source" : "self_project",
    qualifiesForDetailedReview: authorCommits >= 4,
  };
}

async function fetchGitHubSummary(username: string) {
  const [profileResponse, reposResponse] = await Promise.all([
    githubFetch(`https://api.github.com/users/${encodeURIComponent(username)}`),
    githubFetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=all`),
  ]);
  if (!profileResponse.ok) throw new InputError(profileResponse.status === 404 ? "GitHub profile was not found" : "GitHub profile could not be loaded");
  const profile = await profileResponse.json() as { login?: string; bio?: string; public_repos?: number; followers?: number; created_at?: string; blog?: string };
  const repos = reposResponse.ok ? await reposResponse.json() as GitHubRepo[] : [];
  const candidates = repos.filter((repo) => !repo.archived && (!repo.fork || repo.forks_count >= 5 || repo.stargazers_count >= 5)).sort((a, b) => {
    const impactA = a.stargazers_count * 4 + a.forks_count * 3 + (a.homepage ? 5 : 0) + (a.description ? 2 : 0);
    const impactB = b.stargazers_count * 4 + b.forks_count * 3 + (b.homepage ? 5 : 0) + (b.description ? 2 : 0);
    return impactB - impactA || Date.parse(b.updated_at) - Date.parse(a.updated_at);
  }).slice(0, 10);
  const analyzed = await Promise.all(candidates.map((repo) => contributorEvidence(username, repo)));
  const selectedProjects = analyzed.filter((project) => project.qualifiesForDetailedReview).sort((a, b) => {
    const contributionDifference = b.authorCommitCount - a.authorCommitCount;
    if (contributionDifference) return contributionDifference;
    return (b.stars + b.forks) - (a.stars + a.forks);
  }).slice(0, 7);
  return {
    profile: { login: profile.login, bio: profile.bio, publicRepos: profile.public_repos, followers: profile.followers, createdAt: profile.created_at, blog: profile.blog },
    repositoryCount: repos.length,
    analyzedRepositoryCount: analyzed.length,
    qualifyingRepositoryCount: selectedProjects.length,
    selectedProjects,
    classificationNote: "Only up to 10 high-signal repositories were contributor-checked. Detailed projects require at least 4 attributed commits.",
  };
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = body as { resume?: unknown; github?: unknown; provider?: unknown };
    const resume = readRequiredString(input.resume, "Resume text", MAX_RESUME_CHARS);
    const provider = readProvider(input.provider);
    const username = githubUsername(input.github);

    const [profileRaw, github] = await Promise.all([
      generateStructured({ provider, systemPrompt: EXTRACTION_PROMPT, userPrompt: `RESUME\n---\n${resume}\n---`, temperature: 0.1, maxTokens: 4096 }),
      username ? fetchGitHubSummary(username) : Promise.resolve(null),
    ]);
    const profile = validateAiOutput(profileRaw, validateStructuredCandidateProfile);
    const calculatedExperience = experienceDurationSummary(profile.work);
    const evaluationRaw = await generateStructured({
      provider,
      systemPrompt: EVALUATION_PROMPT,
      userPrompt: `STRUCTURED CANDIDATE PROFILE\n---\n${JSON.stringify(profile)}\n---\nDETERMINISTIC EXPERIENCE DURATIONS\n---\n${calculatedExperience.join("\n") || "No dated professional roles were available."}\n---\nUse these calculated durations when discussing years of experience; do not replace them with an estimate.\n\n${github ? `VERIFIED PUBLIC GITHUB EVIDENCE FOR ${username}\n---\n${JSON.stringify(github)}` : "No GitHub profile was supplied. Do not assume GitHub activity."}`,
      temperature: 0.2,
      maxTokens: 4096,
    });
    const result = validateAiOutput(evaluationRaw, validateCandidateEvaluation);
    return NextResponse.json({ ...result, githubEnriched: Boolean(github), pipeline: { structuredExtraction: true, githubRepositoriesAnalyzed: github?.analyzedRepositoryCount ?? 0, githubProjectsSelected: github?.qualifyingRepositoryCount ?? 0 }, source: "Adapted from HackerRank Hiring Agent (MIT)" });
  } catch (error) {
    return aiRouteError(error, "Could not evaluate the candidate portfolio.");
  }
}
