function extractLlmJsonObject(value: string, context: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`${context} response did not contain JSON.`);
  }

  return trimmed.slice(start, end + 1);
}

function normalizeLlmStringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => (typeof item === "string" ? [item.trim().slice(0, maxLength)] : []))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeLlmText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim().slice(0, maxLength);
}

export { extractLlmJsonObject, normalizeLlmStringList, normalizeLlmText };
