/**
 * Client-Side Anti-Spam Hook
 * 
 * Enforces local rate limits and cooldown timers in the browser before sending requests to the server.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseAntiSpamOptions {
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Window duration in seconds */
    windowSeconds: number;
    /** Cooldown duration after hitting the limit in seconds */
    cooldownSeconds: number;
    /** LocalStorage key for persisting cooldown across reloads */
    storageKey: string;
}

interface AntiSpamState {
    /** Whether the user is permitted to make a request right now */
    canRequest: boolean;
    /** Number of requests remaining in the active window */
    remaining: number;
    /** Remaining cooldown in seconds (0 when inactive) */
    cooldownRemaining: number;
    /** Human-readable status string */
    statusMessage: string;
    /** Call before making a request. Returns true if allowed. */
    tryRequest: () => boolean;
    /** Manually triggers a cooldown if the server returns a 429 */
    forceBlock: (seconds: number) => void;
}

export function useAntiSpam(options: UseAntiSpamOptions): AntiSpamState {
    const { maxRequests, windowSeconds, cooldownSeconds, storageKey } = options;

    const [cooldownEnd, setCooldownEnd] = useState(0);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const timestampsRef = useRef<number[]>([]);

    // Restores active cooldown and request timestamps from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`nadi_spam_${storageKey}`);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.cooldownEnd && Date.now() < data.cooldownEnd) {
                    setCooldownEnd(data.cooldownEnd);
                }
                if (data.timestamps) {
                    timestampsRef.current = data.timestamps.filter(
                        (t: number) => Date.now() - t < windowSeconds * 1000
                    );
                }
            }
        } catch { /* ignore */ }
    }, [storageKey, windowSeconds]);

    // Persists cooldown state to localStorage
    const persist = useCallback(() => {
        try {
            localStorage.setItem(`nadi_spam_${storageKey}`, JSON.stringify({
                cooldownEnd,
                timestamps: timestampsRef.current,
            }));
        } catch { /* ignore */ }
    }, [cooldownEnd, storageKey]);

    // Updates countdown timer once per second
    useEffect(() => {
        if (cooldownEnd <= 0) return;

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
            setCooldownRemaining(remaining);
            if (remaining <= 0) setCooldownEnd(0);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [cooldownEnd]);

    const getActiveTimestamps = () => {
        const now = Date.now();
        timestampsRef.current = timestampsRef.current.filter(
            t => now - t < windowSeconds * 1000
        );
        return timestampsRef.current;
    };

    const canRequest = cooldownRemaining <= 0 && getActiveTimestamps().length < maxRequests;
    const remaining = Math.max(0, maxRequests - getActiveTimestamps().length);

    const tryRequest = useCallback((): boolean => {
        if (cooldownEnd > 0 && Date.now() < cooldownEnd) return false;

        const active = getActiveTimestamps();
        if (active.length >= maxRequests) {
            const newEnd = Date.now() + cooldownSeconds * 1000;
            setCooldownEnd(newEnd);
            persist();
            return false;
        }

        timestampsRef.current.push(Date.now());
        persist();
        return true;
    }, [cooldownEnd, maxRequests, cooldownSeconds, persist]);

    const forceBlock = useCallback((seconds: number) => {
        const newEnd = Date.now() + seconds * 1000;
        setCooldownEnd(newEnd);
        persist();
    }, [persist]);

    let statusMessage = '';
    if (cooldownRemaining > 0) {
        statusMessage = `Cooldown: ${cooldownRemaining}s remaining`;
    } else if (remaining <= 2 && remaining > 0) {
        statusMessage = `${remaining} request${remaining > 1 ? 's' : ''} left`;
    }

    return { canRequest, remaining, cooldownRemaining, statusMessage, tryRequest, forceBlock };
}

