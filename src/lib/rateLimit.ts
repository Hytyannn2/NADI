/**
 * NADI Anti-Spam Rate Limiter
 * 
 * Server-side in-memory rate limiting for API routes.
 * Tracks requests per IP with sliding window.
 */

interface RateLimitEntry {
    timestamps: number[];
    blocked: boolean;
    blockExpires: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.timestamps.length === 0 && now > entry.blockExpires) {
            store.delete(key);
        }
    }
}, 5 * 60 * 1000);

interface RateLimitConfig {
    /** Max requests allowed in the window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
    /** How long to block after exceeding limit (seconds) */
    blockDurationSeconds: number;
    /** Identifier for the rate limit bucket (e.g. 'infra-analyze', 'suara-voice') */
    bucketName: string;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
    message: string;
}

export function checkRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const key = `${config.bucketName}:${ip}`;
    const windowMs = config.windowSeconds * 1000;

    let entry = store.get(key);
    if (!entry) {
        entry = { timestamps: [], blocked: false, blockExpires: 0 };
        store.set(key, entry);
    }

    // Check if currently blocked
    if (entry.blocked && now < entry.blockExpires) {
        const retryAfter = Math.ceil((entry.blockExpires - now) / 1000);
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: retryAfter,
            message: `Rate limited. Too many requests. Try again in ${retryAfter}s.`,
        };
    }

    // Unblock if block has expired
    if (entry.blocked && now >= entry.blockExpires) {
        entry.blocked = false;
        entry.blockExpires = 0;
        entry.timestamps = [];
    }

    // Slide the window: remove timestamps older than the window
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    // Check if over limit
    if (entry.timestamps.length >= config.maxRequests) {
        entry.blocked = true;
        entry.blockExpires = now + config.blockDurationSeconds * 1000;
        const retryAfter = config.blockDurationSeconds;
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: retryAfter,
            message: `Spam detected! You've been temporarily blocked for ${retryAfter}s. Chill lah `,
        };
    }

    // Allow the request
    entry.timestamps.push(now);
    const remaining = config.maxRequests - entry.timestamps.length;

    return {
        allowed: true,
        remaining,
        retryAfterSeconds: 0,
        message: 'OK',
    };
}

// ============================================
// Pre-configured limiters for each feature
// ============================================

/** Voice/Suara: 5 requests per 60 seconds, 2 min block */
export function checkSuaraLimit(ip: string) {
    return checkRateLimit(ip, {
        maxRequests: 5,
        windowSeconds: 60,
        bucketName: 'suara-voice',
        blockDurationSeconds: 120,
    });
}

/** Infra AI Analyze: 10 requests per 60 seconds, 1 min block */
export function checkInfraAnalyzeLimit(ip: string) {
    return checkRateLimit(ip, {
        maxRequests: 10,
        windowSeconds: 60,
        bucketName: 'infra-analyze',
        blockDurationSeconds: 60,
    });
}

/** Infra Vision (photo): 5 requests per 60 seconds, 2 min block (images are expensive) */
export function checkInfraVisionLimit(ip: string) {
    return checkRateLimit(ip, {
        maxRequests: 5,
        windowSeconds: 60,
        bucketName: 'infra-vision',
        blockDurationSeconds: 120,
    });
}
