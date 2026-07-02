type GuestbookMessagesPaginationInput = {
  page?: number;
  pageSize?: number;
  viewerUserId?: string | null;
};

function normalizeGuestbookMessagesQuery(input: GuestbookMessagesPaginationInput) {
  return {
    page: normalizePositiveInteger(input.page, 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: normalizePositiveInteger(input.pageSize, 20, 1, 50),
  };
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

export { normalizeGuestbookMessagesQuery, type GuestbookMessagesPaginationInput };
