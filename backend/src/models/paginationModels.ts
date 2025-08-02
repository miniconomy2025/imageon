
export interface PaginationOptions {
  limit?: number;
  lastEvaluatedKey?: Record<string, any>;
}

export interface PaginatedResult<T> {
  items: T[];
  count: number;
  lastEvaluatedKey?: Record<string, any>; 
}