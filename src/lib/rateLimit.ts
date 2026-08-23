/**
 * In-Memory Rate Limiter & Throttling
 * 
 * Uses a sliding window algorithm to protect endpoints from abuse and control AI inference costs.
 * Note: Memory is isolated per serverless instance. For distributed production setups,
 * replace the internal Map with a shared store like Upstash Redis.
 */

import { NextResponse } from 'next/server';

export interface RateLimitConfig {
    /** Maximum requests permitted within the time window */
    maxRequests: number;
    /** Window duration in seconds */
    windowSeconds: number;
    /** Grouping key for the limiter (e.g., 'suara-voice', 'sensor') */
    bucketName: string;
}

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetSeconds: number;
    retryAfterSeconds: number;
    message: string;
}

interface RateLimitEntry {
    timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();
const MAX_STORE_ENTRIES = 5000;

/**
 * Removes entries inactive for more than 5 minutes to prevent unbounded memory growth.
 */
function cleanupStaleEntries(now: number) {
    if (store.size > MAX_STORE_ENTRIES) {
        const keysToDelete: string[] = [];
        for (const [key, entry] of store.entries()) {
            if (entry.timestamps.length === 0 || now - entry.timestamps[entry.timestamps.length - 1] > 300000) {
                keysToDelete.push(key);
            }
            if (keysToDelete.length > 500) break;
        }
        for (const k of keysToDelete) {
            store.delete(k);
        }
    }
}

/**
 * Extracts client IP from reverse proxy headers (Cloudflare, Vercel, standard proxies).
 * Falls back to a deterministic header hash if no IP header is present.
 */
export function getClientIp(headers: Headers): string {
    const cfIp = headers.get('cf-connecting-ip');
    if (cfIp) return cfIp.trim();

    const vercelIp = headers.get('x-vercel-forwarded-for');
    if (vercelIp) return vercelIp.split(',')[0].trim();

    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();

    const realIp = headers.get('x-real-ip');
    if (realIp) return realIp.trim();

    // Fallback: build a quick fingerprint using User-Agent and Accept-Language
    const ua = headers.get('user-agent') || 'anon';
    const lang = headers.get('accept-language') || 'ms';
    let hash = 0;
    const raw = `${ua}:${lang}`;
    for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
    }
    return `fp-${Math.abs(hash).toString(36)}`;
}

/**
 * Checks whether an incoming request is within its allowed rate limit window.
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const key = `${config.bucketName}:${identifier}`;

    cleanupStaleEntries(now);

    let entry = store.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
    }

    // Keep only timestamps that fall inside the active window
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    // Calculate when the oldest request in the window expires
    const oldestTimestamp = entry.timestamps.length > 0 ? entry.timestamps[0] : now;
    const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

    if (entry.timestamps.length >= config.maxRequests) {
        return {
            allowed: false,
            limit: config.maxRequests,
            remaining: 0,
            resetSeconds,
            retryAfterSeconds: resetSeconds,
            message: `Terlalu banyak permintaan. Sila tunggu ${resetSeconds} saat sebelum mencuba lagi.`,
        };
    }

    // Record the current timestamp and approve request
    entry.timestamps.push(now);
    const remaining = config.maxRequests - entry.timestamps.length;

    return {
        allowed: true,
        limit: config.maxRequests,
        remaining,
        resetSeconds,
        retryAfterSeconds: 0,
        message: 'OK',
    };
}

/**
 * Attaches standard rate-limit headers to a Next.js response.
 */
export function addRateLimitHeaders(response: NextResponse, limit: RateLimitResult): NextResponse {
    response.headers.set('X-RateLimit-Limit', String(limit.limit));
    response.headers.set('X-RateLimit-Remaining', String(limit.remaining));
    response.headers.set('X-RateLimit-Reset', String(limit.resetSeconds));
    if (!limit.allowed && limit.retryAfterSeconds > 0) {
        response.headers.set('Retry-After', String(limit.retryAfterSeconds));
    }
    return response;
}

// -----------------------------------------------------------------------------
// Endpoint-Specific Limits
// -----------------------------------------------------------------------------

/** Voice transcription: max 5 requests per minute (controls audio API costs) */
export function checkSuaraLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 5,
        windowSeconds: 60,
        bucketName: 'suara-voice',
    });
}

/** Vision image classifier: max 5 requests per minute */
export function checkInfraVisionLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 5,
        windowSeconds: 60,
        bucketName: 'infra-vision',
    });
}

/** Report text triage: max 10 requests per minute */
export function checkInfraAnalyzeLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 10,
        windowSeconds: 60,
        bucketName: 'infra-analyze',
    });
}

/** Heatmap clustering: max 20 requests per minute */
export function checkInfraClusterLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 20,
        windowSeconds: 60,
        bucketName: 'infra-cluster',
    });
}

/** Community board posts: max 5 posts per minute */
export function checkKomunitiLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 5,
        windowSeconds: 60,
        bucketName: 'komuniti-post',
    });
}

/** Welfare aid applications: max 3 submissions per minute */
export function checkBantuanRequestLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 3,
        windowSeconds: 60,
        bucketName: 'bantuan-request',
    });
}

/** Dialect feedback submissions: max 10 submissions per minute */
export function checkDialectFeedbackLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 10,
        windowSeconds: 60,
        bucketName: 'dialect-feedback',
    });
}

/**
 * Sensor ingestion limiter.
 * Verified hardware nodes get a higher limit (120 req/min) than public IPs (15 req/min).
 */
export function checkSensorLimit(identifier: string, isHardwareKey = false): RateLimitResult {
    if (isHardwareKey) {
        return checkRateLimit(`hw-${identifier}`, {
            maxRequests: 120,
            windowSeconds: 60,
            bucketName: 'sensor-hw',
        });
    }

    return checkRateLimit(identifier, {
        maxRequests: 15,
        windowSeconds: 60,
        bucketName: 'sensor-ip',
    });
}

