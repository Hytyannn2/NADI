/**
 * NADI Bot & Anti-Spam Intelligence Engine
 * Detects automated bots, spam patterns, gibberish keyboard smashing, and duplicate flooding.
 * Automatically bans bot accounts and IPs exceeding risk thresholds.
 */

interface RecentUserPost {
    content: string;
    timestamp: number;
}

// In-memory ban list & post velocity history
const bannedIPs = new Set<string>();
const bannedUserIds = new Set<string>();
const userPostHistory = new Map<string, RecentUserPost[]>();

// Common gibberish / keyboard mash regexes
const GIBBERISH_REGEX = /(.)\1{4,}|(qwerty|asdfgh|zxcvbn|123456|abcdef|testtest|aaaaa|bbbbb)/i;

// Spam URL / promotional scam regexes
const SPAM_URL_REGEX = /(t\.me\/|wa\.me\/|bit\.ly\/|crypto|casino|slot|gacor|poker|whatsapp|telegram|http:\/\/|https:\/\/)/i;

export interface BotCheckResult {
    isBot: boolean;
    isBanned: boolean;
    score: number; // 0 to 100
    reason?: string;
}

/**
 * Evaluates whether a post request comes from a bot or spammer.
 */
export function evaluateBotRisk(content: string, userId: string, ip: string): BotCheckResult {
    // 1. Check if user or IP is already permanently banned
    if (bannedIPs.has(ip) || bannedUserIds.has(userId)) {
        return { isBot: true, isBanned: true, score: 100, reason: 'Akaun/IP anda telah disekat secara kekal kerana aktiviti bot.' };
    }

    let score = 0;
    const cleanContent = content.trim();

    // 2. Minimum Length Check
    if (cleanContent.length < 2) {
        score += 30;
    }

    // 3. Gibberish / Character Smashing Check
    if (GIBBERISH_REGEX.test(cleanContent)) {
        score += 45;
    }

    // 4. Spam URL / Promo Scams Check
    if (SPAM_URL_REGEX.test(cleanContent)) {
        score += 50;
    }

    // 5. Velocity & Duplicate Content Tracking
    const now = Date.now();
    const key = `${userId}_${ip}`;
    const history = userPostHistory.get(key) || [];

    // Clean up posts older than 5 minutes (300,000 ms)
    const recentHistory = history.filter(p => now - p.timestamp < 300000);

    // Check burst rate (more than 3 posts in 10 seconds = bot spam)
    const superRecent = recentHistory.filter(p => now - p.timestamp < 10000);
    if (superRecent.length >= 3) {
        score += 60;
    }

    // Check exact duplicate content in last 5 minutes (e.g. posting exact same string repeatedly)
    const isDuplicate = recentHistory.some(p => p.content.toLowerCase() === cleanContent.toLowerCase());
    if (isDuplicate) {
        score += 50;
    }

    // Update history
    recentHistory.push({ content: cleanContent, timestamp: now });
    userPostHistory.set(key, recentHistory);

    // 6. Action Determination
    // Score >= 80 -> AUTO BAN PERMANENTLY
    if (score >= 80) {
        bannedIPs.add(ip);
        if (userId) bannedUserIds.add(userId);
        console.warn(`[BOT BAN] Banned User ${userId} / IP ${ip} due to Bot Score: ${score}`);
        return {
            isBot: true,
            isBanned: true,
            score,
            reason: 'Sistem mengesan aktiviti automatik (bot). Akaun anda telah disekat kekal.'
        };
    }

    // Score >= 50 -> REJECT POST (SUSPECTED SPAM)
    if (score >= 50) {
        return {
            isBot: true,
            isBanned: false,
            score,
            reason: 'Mesej ditolak kerana disyaki spam atau teks tidak bererti.'
        };
    }

    return { isBot: false, isBanned: false, score };
}
