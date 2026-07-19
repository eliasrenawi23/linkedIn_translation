import { NextResponse } from "next/server";
import { generateStructured } from "@/app/lib/ai/provider";
import { aiRouteError, validateAiOutput } from "@/app/lib/ai/http";
import { validateCandidateEvaluation } from "@/app/lib/ai/schemas";
import { MAX_RESUME_CHARS, readProvider, readRequiredString, InputError } from "@/app/lib/input-validation";

const SYSTEM_PROMPT = `You are an evidence-based technical portfolio evaluator. This rubric is adapted from HackerRank's MIT-licensed Hiring Agent project.

Fairness rules:
- Ignore name, gender, age, demographic information, school names, grades, geography, photos, and other protected or irrelevant characteristics.
- Score only technical evidence in the supplied resume and optional GitHub summary.
- Never invent contributions, users, metrics, production use, links, skills, or experience.
- Personal repositories are not open-source contributions to other projects.
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

function githubUsername(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new InputError("GitHub username must be text");
  const normalized = value.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").split(/[\/?#]/)[0];
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(normalized)) throw new InputError("Enter a valid GitHub username or profile URL");
  return normalized;
}

async function fetchGitHubSummary(username: string): Promise<string> {
  const headers: HeadersInit = { Accept: "application/vnd.github+json", "User-Agent": "LinkedIn-Career-Suite" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const [profileResponse, reposResponse] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers, signal: controller.signal, cache: "no-store" }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { headers, signal: controller.signal, cache: "no-store" }),
    ]);
    if (!profileResponse.ok) throw new InputError(profileResponse.status === 404 ? "GitHub profile was not found" : "GitHub profile could not be loaded");
    const profile = await profileResponse.json() as { login?: string; bio?: string; public_repos?: number; followers?: number; created_at?: string };
    const repos = reposResponse.ok ? await reposResponse.json() as Array<{ name: string; description: string | null; language: string | null; stargazers_count: number; forks_count: number; fork: boolean; archived: boolean; topics?: string[] }> : [];
    const topRepos = repos.filter((repo) => !repo.archived).sort((a, b) => (b.stargazers_count + b.forks_count) - (a.stargazers_count + a.forks_count)).slice(0, 12);
    return JSON.stringify({ profile: { login: profile.login, bio: profile.bio, publicRepos: profile.public_repos, followers: profile.followers, createdAt: profile.created_at }, repositories: topRepos.map((repo) => ({ name: repo.name, description: repo.description, language: repo.language, stars: repo.stargazers_count, forks: repo.forks_count, isFork: repo.fork, topics: repo.topics?.slice(0, 8) })) });
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = body as { resume?: unknown; github?: unknown; provider?: unknown };
    const resume = readRequiredString(input.resume, "Resume text", MAX_RESUME_CHARS);
    const provider = readProvider(input.provider);
    const username = githubUsername(input.github);
    const github = username ? await fetchGitHubSummary(username) : null;
    const raw = await generateStructured({
      provider,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `RESUME\n---\n${resume}\n---\n${github ? `PUBLIC GITHUB SUMMARY FOR ${username}\n---\n${github}` : "No GitHub profile was supplied. Do not assume GitHub activity."}`,
      temperature: 0.2,
      maxTokens: 4096,
    });
    const result = validateAiOutput(raw, validateCandidateEvaluation);
    return NextResponse.json({ ...result, githubEnriched: Boolean(github), source: "Adapted from HackerRank Hiring Agent (MIT)" });
  } catch (error) {
    return aiRouteError(error, "Could not evaluate the candidate portfolio.");
  }
}
