export class StructuredJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructuredJsonError";
  }
}

function extractFirstJsonObject(value: string): string | null {
  const start = value.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let insideString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (insideString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') insideString = false;
      continue;
    }

    if (character === '"') insideString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }

  return null;
}

export function parseStructuredJson(content: string): unknown {
  const cleaned = content.replace(/^\uFEFF/, "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!cleaned) throw new StructuredJsonError("Structured response was empty");

  try {
    return JSON.parse(cleaned);
  } catch {
    const extracted = extractFirstJsonObject(cleaned);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch {
        // Fall through to the stable parsing error below.
      }
    }
  }

  throw new StructuredJsonError("Structured response was malformed or incomplete");
}
