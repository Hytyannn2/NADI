interface Bucket {
  tokens: number;
  lastRefill: number;
  bannedUntil?: number;
}

const rateLimiter = new Map<string, Bucket>();

// Extreme Optimization: Token Bucket Algorithm
// Limit users to 5 AI requests, refills 1 token every 60 seconds
export const MAX_TOKENS = 5;
export const REFILL_RATE_MS = 60000; 

// If they exhaust tokens, they get a TEMPORARY BAN (15 minutes cooldown)
export const BAN_DURATION_MS = 15 * 60000; 

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  // Bypass rate limiting in local development to avoid blocking testing
  if (process.env.NODE_ENV === 'development') {
    return { allowed: true };
  }

  const now = Date.now();
  const bucket = rateLimiter.get(identifier);

  if (!bucket) {
    // First time
    rateLimiter.set(identifier, { tokens: MAX_TOKENS - 1, lastRefill: now });
    return { allowed: true };
  }

  // Check if currently banned
  if (bucket.bannedUntil) {
    if (now < bucket.bannedUntil) {
      return { allowed: false, retryAfter: Math.ceil((bucket.bannedUntil - now) / 1000) };
    } else {
      // Unban them
      bucket.bannedUntil = undefined;
      bucket.tokens = MAX_TOKENS;
      bucket.lastRefill = now;
    }
  }

  // Refill tokens based on time passed
  const timePassed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(timePassed / REFILL_RATE_MS);
  
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  // Consume a token
  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { allowed: true };
  } else {
    // Tokens depleted -> Trigger Temporary Ban (Long Cooldown)
    bucket.bannedUntil = now + BAN_DURATION_MS;
    return { allowed: false, retryAfter: BAN_DURATION_MS / 1000 };
  }
}
