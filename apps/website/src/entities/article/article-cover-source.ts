function getArticleCoverSource(value: string | null) {
  if (!value) return null;
  const source = value.trim();
  if (source.startsWith("/") && !source.startsWith("//")) return source;

  try {
    const url = new URL(source);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export { getArticleCoverSource };
