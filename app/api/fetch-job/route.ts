import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { InputError, MAX_JOB_DESCRIPTION_CHARS, readRequiredString } from "@/app/lib/input-validation";

export const runtime = "nodejs";

const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

function isPrivateIp(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateIp(normalized.slice(7));
  if (isIP(normalized) !== 4) return false;

  const [a, b] = normalized.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function validatePublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new InputError("Enter a valid job-post URL");
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new InputError("Only public HTTP(S) URLs without credentials are supported");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    throw new InputError("Local and private network URLs are not allowed");
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new InputError("Local and private network URLs are not allowed");
  }
  return url;
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new InputError("The job page is too large to import");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchPublicPage(initialUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  let currentUrl = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    currentUrl = await validatePublicUrl(currentUrl.toString());
    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "JobMatchAnalyzer/1.0 (+job-description-import)", Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new InputError("The job page redirected too many times");
      currentUrl = new URL(location, currentUrl);
      continue;
    }
    if (!response.ok) throw new InputError(`The job page returned HTTP ${response.status}`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new InputError("The URL did not return an HTML page");
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_RESPONSE_BYTES) throw new InputError("The job page is too large to import");
    return { html: await readLimitedText(response), finalUrl: currentUrl };
  }
  throw new InputError("Unable to follow the job page redirect");
}

function decodeHtml(value: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return entities[entity.toLowerCase()] ?? " ";
  });
}

function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["']`, "i"),
  ];
  return decodeHtml(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) ?? "").trim();
}

function extractJobPage(html: string): { title: string; company: string; description: string } {
  const titleTag = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const title = metaContent(html, "og:title") || titleTag;
  const company = metaContent(html, "og:site_name");
  const metaDescription = metaContent(html, "description") || metaContent(html, "og:description");
  const body = html
    .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|p|div|li|section|article|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const readable = decodeHtml(body).replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const sections = [title && `Job title: ${title}`, company && `Company: ${company}`, metaDescription, readable].filter(Boolean);
  return { title, company, description: sections.join("\n\n").slice(0, MAX_JOB_DESCRIPTION_CHARS) };
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const rawUrl = readRequiredString((body as { url?: unknown })?.url, "Job URL", 2_000);
    const url = await validatePublicUrl(rawUrl);
    const { html, finalUrl } = await fetchPublicPage(url);
    const extracted = extractJobPage(html);
    if (extracted.description.length < 100) throw new InputError("Could not extract enough job text. This page may require a login; paste the description instead.");
    return NextResponse.json({ ...extracted, sourceUrl: finalUrl.toString() });
  } catch (error: unknown) {
    const message = error instanceof InputError ? error.message : error instanceof Error && error.name === "TimeoutError" ? "The job page took too long to respond" : "Could not import this job page";
    return NextResponse.json({ error: message }, { status: error instanceof InputError ? 400 : 502 });
  }
}
