type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type PaginatedResponse<TItem> = {
  data: TItem[];
  pagination: PaginationMeta;
};

export type { PaginatedResponse, PaginationMeta };
