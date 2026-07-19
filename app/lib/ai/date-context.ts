export function currentDateContext(now = new Date()): string {
  const isoDate = now.toISOString().slice(0, 10);
  return `
CURRENT DATE AND EXPERIENCE CALCULATION RULES:
- Today's date is ${isoDate}.
- Treat "Present", "Current", "Now", and ongoing roles as ending on ${isoDate}.
- Calculate experience from the explicit start and end dates in the supplied evidence.
- When month and year are available, count completed months and express the result accurately; do not round a partial year to a misleading value.
- When only years are available, label the duration approximate instead of inventing months.
- Do not double-count overlapping jobs, projects, education, or volunteer periods when describing total professional experience.
- Distinguish professional experience from education, personal projects, and unrelated work.
- If dates are missing or ambiguous, state that the duration cannot be determined reliably instead of guessing.
`;
}

export function addCurrentDateContext(prompt: string, now = new Date()): string {
  return `${prompt.trim()}\n\n${currentDateContext(now).trim()}`;
}

type DatedRole = { position: string; startDate: string; endDate: string };

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function monthIndex(value: string, now: Date): { index: number; precise: boolean } | null {
  const normalized = value.trim().toLowerCase();
  if (/^(present|current|now|ongoing)$/.test(normalized)) return { index: now.getUTCFullYear() * 12 + now.getUTCMonth(), precise: true };
  const iso = normalized.match(/^(\d{4})-(0?[1-9]|1[0-2])$/);
  if (iso) return { index: Number(iso[1]) * 12 + Number(iso[2]) - 1, precise: true };
  const named = normalized.match(/^([a-z]+)\s+(\d{4})$/);
  if (named && MONTHS[named[1]] !== undefined) return { index: Number(named[2]) * 12 + MONTHS[named[1]], precise: true };
  const year = normalized.match(/^(\d{4})$/);
  if (year) return { index: Number(year[1]) * 12, precise: false };
  return null;
}

export function experienceDurationSummary(roles: DatedRole[], now = new Date()): string[] {
  return roles.flatMap((role) => {
    const start = monthIndex(role.startDate, now);
    const end = monthIndex(role.endDate, now);
    if (!start || !end || end.index < start.index) return [`${role.position}: duration cannot be calculated reliably from ${role.startDate} to ${role.endDate}.`];
    const months = end.index - start.index;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const duration = [years ? `${years} year${years === 1 ? "" : "s"}` : "", remainingMonths ? `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ") || "less than one month";
    return [`${role.position}: ${start.precise && end.precise ? duration : `approximately ${duration}`} (${role.startDate} to ${role.endDate}, calculated through ${now.toISOString().slice(0, 10)}).`];
  });
}
