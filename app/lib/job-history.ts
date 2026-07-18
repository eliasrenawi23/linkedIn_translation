export const JOB_HISTORY_STORAGE_KEY = "linkedin-career-suite:job-history:v1";
export const JOB_HISTORY_EXPORT_VERSION = 1;
export const MAX_HISTORY_ENTRIES = 30;

export type JobHistoryEntry = {
  id: string;
  createdAt: string;
  title: string;
  company: string;
  sourceUrl: string;
  score: number;
  recommendation: "Apply" | "Apply with Reservations" | "Do Not Apply";
  resumeVersion: string;
  matchingSkills: string[];
  missingSkills: string[];
  criticalGaps: string[];
  favorite: boolean;
};

export type JobHistoryExport = {
  version: 1;
  exportedAt: string;
  entries: JobHistoryEntry[];
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim().slice(0, 2_000) : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 20).map((item) => item.trim().slice(0, 500)) : [];
}

export function parseHistoryEntry(value: unknown): JobHistoryEntry | null {
  const entry = record(value);
  if (!entry) return null;
  const score = Number(entry.score);
  const recommendation = entry.recommendation;
  if (!Number.isInteger(score) || score < 0 || score > 100) return null;
  if (recommendation !== "Apply" && recommendation !== "Apply with Reservations" && recommendation !== "Do Not Apply") return null;
  const id = text(entry.id);
  const createdAt = text(entry.createdAt);
  if (!id || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  return {
    id,
    createdAt,
    title: text(entry.title, "Untitled role") || "Untitled role",
    company: text(entry.company, "Unknown company") || "Unknown company",
    sourceUrl: text(entry.sourceUrl),
    score,
    recommendation,
    resumeVersion: text(entry.resumeVersion, "Unspecified resume") || "Unspecified resume",
    matchingSkills: strings(entry.matchingSkills),
    missingSkills: strings(entry.missingSkills),
    criticalGaps: strings(entry.criticalGaps),
    favorite: entry.favorite === true,
  };
}

export function parseHistory(value: unknown): JobHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseHistoryEntry).filter((entry): entry is JobHistoryEntry => entry !== null).slice(0, MAX_HISTORY_ENTRIES);
}

export function parseHistoryImport(value: unknown): JobHistoryEntry[] {
  const payload = record(value);
  if (!payload || payload.version !== JOB_HISTORY_EXPORT_VERSION) throw new Error("Unsupported history export version");
  if (!Array.isArray(payload.entries)) throw new Error("History export is missing entries");
  const parsed = parseHistory(payload.entries);
  if (payload.entries.length > 0 && parsed.length === 0) throw new Error("History export contains no valid entries");
  return parsed;
}

export function loadJobHistory(storage: Pick<Storage, "getItem">): JobHistoryEntry[] {
  try {
    const stored = storage.getItem(JOB_HISTORY_STORAGE_KEY);
    return stored ? parseHistory(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

export function writeJobHistory(storage: Pick<Storage, "setItem">, entries: JobHistoryEntry[]): JobHistoryEntry[] {
  const normalized = parseHistory(entries).sort((a, b) => Number(b.favorite) - Number(a.favorite) || Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, MAX_HISTORY_ENTRIES);
  storage.setItem(JOB_HISTORY_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function upsertJobHistory(storage: Pick<Storage, "getItem" | "setItem">, entry: JobHistoryEntry): JobHistoryEntry[] {
  const current = loadJobHistory(storage).filter((item) => item.id !== entry.id);
  return writeJobHistory(storage, [entry, ...current]);
}

export function createHistoryExport(entries: JobHistoryEntry[]): JobHistoryExport {
  return { version: JOB_HISTORY_EXPORT_VERSION, exportedAt: new Date().toISOString(), entries: parseHistory(entries) };
}
