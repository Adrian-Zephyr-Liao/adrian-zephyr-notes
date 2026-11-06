type Snapshot = { json: string; dates: string[][] };

/** Preserve dates explicitly without interpreting user JSON as serialization tags. */
export function encodePiSnapshot(value: unknown): Snapshot {
  const dates: string[][] = [];
  function visit(item: unknown, path: string[]): unknown {
    if (item instanceof Date) {
      dates.push(path);
      return item.toISOString();
    }
    if (Array.isArray(item))
      return item.map((child, index) => visit(child, [...path, String(index)]));
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item).map(([key, child]) => [key, visit(child, [...path, key])]),
      );
    }
    return item;
  }
  return { json: JSON.stringify(visit(value, [])), dates };
}

/** Decode a server-created checkpoint; its generic type is fixed by the task definition. */
export function decodePiSnapshot<T>(snapshot: Snapshot): T {
  const value = JSON.parse(snapshot.json);
  for (const path of snapshot.dates) {
    let parent = value;
    for (const key of path.slice(0, -1)) parent = parent[key];
    const key = path.at(-1)!;
    parent[key] = new Date(parent[key]);
  }
  return value as T;
}
