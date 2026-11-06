function normalizeTaxonomyPage(value: string | string[] | undefined) {
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  const page = first && /^\d+$/.test(first) ? Number(first) : 1;
  return Number.isSafeInteger(page) && page > 0 && page <= 10_000 ? page : 1;
}

export { normalizeTaxonomyPage };
