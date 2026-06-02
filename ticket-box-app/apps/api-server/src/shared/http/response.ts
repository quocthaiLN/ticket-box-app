export type ApiMeta = {
  request_id: string;
  [key: string]: unknown;
};

export type ApiPagination = {
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
};

export type ApiResponse<TData> = {
  data: TData;
  meta: ApiMeta;
};

export type ApiCollectionResponse<TData> = ApiResponse<TData[]> & {
  pagination: ApiPagination;
};

export function ok<TData>(data: TData, requestId: string, meta: Record<string, unknown> = {}): ApiResponse<TData> {
  return {
    data,
    meta: {
      request_id: requestId,
      ...meta
    }
  };
}

export function collection<TData>(
  data: TData[],
  requestId: string,
  pagination: ApiPagination
): ApiCollectionResponse<TData> {
  return {
    data,
    pagination,
    meta: {
      request_id: requestId
    }
  };
}
