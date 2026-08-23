/**
 * NADI Resilient Rate Limiter & Hardware Throttling Engine
 * 
 * ARCHITECTURE NOTICE:
 * This module uses an in-memory sliding window algorithm. It is highly optimized
 * for single-instance, pilot, and demo environments to prevent accidental loops,
 * abuse, and runaway AI inference costs.
 * 
 * In multi-region serverless deployments (Vercel edge lambdas), memory is isolated
 * per instance. For high-scale production, this interface is designed for drop-in
 * integration with a shared Redis store (e.g. Upstash Redis).
 */

import { NextResponse } from 'next/server';

export interface RateLimitConfig {
    /** Max requests allowed in the time window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
    /** Identifier for the rate limit bucket (e.g. 'suara-voice', 'sensor') */
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
 * Opportunistic cleanup of stale entries to guarantee zero memory leaks.
 */
function cleanupStaleEntries(now: number) {
    if (store.size > MAX_STORE_ENTRIES) {
        // Drop oldest entries if store exceeds threshold
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
 * Robust Client IP Resolution across Cloudflare, Vercel, and standard proxies.
 * Falls back to a deterministic header fingerprint if IP is obscured.
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

    // Fallback: create an isolated client fingerprint from available headers
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
 * Core Sliding Window Rate Limiter
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

    // Slide window: retain only timestamps within current window
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    // Calculate reset time based on oldest timestamp in window
    const oldestTimestamp = entry.timestamps.length > 0 ? entry.timestamps[0] : now;
    const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

    // Check limit
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

    // Allow request & push timestamp
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
 * Helper to attach standard RFC rate-limiting headers to any NextResponse.
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

// =========================================================================
// Pre-configured Feature Limiters
// =========================================================================

/** Voice Transcription: 5 req/min (Protects Groq AI audio parse budget) */
export function checkSuaraLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 5,
        windowSeconds: 60,
        bucketName: 'suara-voice',
    });
}

/** AI Vision Classifier: 5 req/min (Protects image analysis inference) */
export function checkInfraVisionLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 5,
        windowSeconds: 60,
        bucketName: 'infra-vision',
    });
}

/** AI Text Triage: 10 req/min (Citizen report text categorizer) */
export function checkInfraAnalyzeLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 10,
        windowSeconds: 60,
        bucketName: 'infra-analyze',
    });
}

/** Civic Cluster Engine: 20 req/min (Heatmap clustering calculations) */
export function checkInfraClusterLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 20,
        windowSeconds: 60,
        bucketName: 'infra-cluster',
    });
}

/** Community Board: 5 posts/min (Prevents job/vendor listing spam) */
export function checkKomunitiLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 5,
        windowSeconds: 60,
        bucketName: 'komuniti-post',
    });
}

/** Mutual Aid Requests: 3 submissions/min */
export function checkBantuanRequestLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 3,
        windowSeconds: 60,
        bucketName: 'bantuan-request',
    });
}

/** Dialect Corpus Feedback: 10 feedback submissions/min */
export function checkDialectFeedbackLimit(ip: string): RateLimitResult {
    return checkRateLimit(ip, {
        maxRequests: 10,
        windowSeconds: 60,
        bucketName: 'dialect-feedback',
    });
}

/**
 * Sensor Ingestion Rate Limiter with Hardware Node Key Exemption
 * 
 * @param identifier Client IP or validated Hardware Node Key
 * @param isHardwareKey When true, uses high-throughput device bucket (120 req/min)
 */
export function checkSensorLimit(identifier: string, isHardwareKey = false): RateLimitResult {
    if (isHardwareKey) {
        // Authenticated ESP32 / LoRaWAN Node: 120 req/min per physical device
        return checkRateLimit(`hw-${identifier}`, {
            maxRequests: 120,
            windowSeconds: 60,
            bucketName: 'sensor-hw',
        });
    }

    // Unauthenticated public IP: 15 req/min
    return checkRateLimit(identifier, {
        maxRequests: 15,
        windowSeconds: 60,
        bucketName: 'sensor-ip',
    });
}
