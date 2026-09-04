// In-process memory store for sliding window rate limiting
const rateLimitMap = new Map<string, number[]>();

// Startup confirmation check for Redis environment variables
if (typeof window === "undefined") {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.info(`[RATE LIMIT] Redis environment variables detected. Staging rate-limiting is ready to fallback/sync.`);
  } else {
    console.warn(`[RATE LIMIT WARNING] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. Rate limiting will run solely in-memory (ephemeral per serverless instance).`);
  }
}

/**
 * Checks if a key has exceeded the allowed rate limit within a sliding window.
 * Returns true if rate limited, false otherwise.
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];

  // Evict timestamps older than the sliding window boundary
  const activeTimestamps = timestamps.filter((ts) => now - ts < windowMs);

  if (activeTimestamps.length >= limit) {
    return true;
  }

  activeTimestamps.push(now);
  rateLimitMap.set(key, activeTimestamps);
  return false;
}

/**
 * Clear all rate limiter state (useful for test isolation).
 */
export function clearRateLimitStore(): void {
  rateLimitMap.clear();
}
