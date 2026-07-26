/**
 * NADI Post Cooldown & Rate Limiter
 * Standard friendly cooldown protection without account bans or bot algorithms.
 */

const lastPostTimestamps = new Map<string, number>();

export interface CooldownCheckResult {
    allowed: boolean;
    reason?: string;
}

/**
 * Checks if a user is posting too rapidly (cooldown of 3 seconds).
 * Returns a friendly standard message if triggered.
 */
export function checkPostCooldown(userId: string, ip: string): CooldownCheckResult {
    const key = userId || ip;
    const now = Date.now();
    const lastTime = lastPostTimestamps.get(key) || 0;
    const cooldownMs = 3000; // 3 seconds cooldown between posts

    if (now - lastTime < cooldownMs) {
        const remainingSec = Math.ceil((cooldownMs - (now - lastTime)) / 1000);
        return {
            allowed: false,
            reason: `Terlalu banyak percubaan. Sila tunggu ${remainingSec} saat sebelum menghantar semula.`
        };
    }

    lastPostTimestamps.set(key, now);
    return { allowed: true };
}
