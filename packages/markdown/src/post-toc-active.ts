type TocHeadingPosition = {
  id: string;
  top: number;
};

function getActiveTocHeadingId(headings: TocHeadingPosition[], readingAnchorTop: number) {
  if (headings.length === 0) {
    return null;
  }

  let activeHeadingId = headings[0]?.id ?? null;

  for (const heading of headings) {
    if (heading.top > readingAnchorTop) {
      break;
    }

    activeHeadingId = heading.id;
  }

  return activeHeadingId;
}

export { getActiveTocHeadingId };
export type { TocHeadingPosition };
