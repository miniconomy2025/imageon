
/**
 * Options for paginated follow queries (e.g., get followers or following).
 * Uses DynamoDB's LastEvaluatedKey / ExclusiveStartKey pattern for cursor pagination. :contentReference[oaicite:2]{index=2}
 */
export interface PaginationOptions {
  limit?: number;
  lastEvaluatedKey?: Record<string, any>; // DynamoDB key used as ExclusiveStartKey
}

/**
 * Generic paginated response wrapper.
 */
export interface PaginatedResult<T> {
  items: T[];
  count: number;
  lastEvaluatedKey?: Record<string, any>; // carry forward for next page. :contentReference[oaicite:3]{index=3}
}
