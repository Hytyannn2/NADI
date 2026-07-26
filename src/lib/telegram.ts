/**
 * NADI Telegram Alert Service
 *
 * Sends flood alerts to a Telegram group/channel.
 * Used by the webhook (real sensor data) and simulation (testing).
 *
 * Setup:
 * 1. Message @BotFather on Telegram → /newbot → copy the token
 * 2. Add the bot to your group → send a message in the group
 * 3. Visit https://api.telegram.org/bot<TOKEN>/getUpdates → find chat_id
 * 4. Add to .env.local:
 *    TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
 *    TELEGRAM_CHAT_ID=-100XXXXXXXXXX
 */

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface TelegramAlertData {
    sensorName: string;
    location: string;
    waterLevel: number;
    status: 'warning' | 'danger';
    riseRate?: number;
    batteryPct?: number | null;
    temperatureC?: number | null;
    rssiDbm?: number | null;
}

/**
 * Send a flood alert to the configured Telegram group.
 * Returns true if sent, false if Telegram is not configured (non-fatal).
 */
export async function sendTelegramAlert(data: TelegramAlertData): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.log('[Telegram] Skipped — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
        return false;
    }

    const isDanger = data.status === 'danger';
    const icon = isDanger ? '🚨' : '⚠️';
    const statusLabel = isDanger ? 'BAHAYA' : 'AMARAN AWAL';

    // Estimate time to danger level (120cm)
    const timeEstimate = data.riseRate && data.riseRate > 0 && data.waterLevel < 120
        ? `⏱️ Anggaran ${Math.max(1, Math.round((120 - data.waterLevel) / data.riseRate))} jam ke paras bahaya`
        : null;

    // Build message in Malay (target audience: rural Kelantan communities)
    const lines: string[] = [
        `${icon} ${statusLabel} — JAGA KELANTAN`,
        ``,
        `📍 ${data.sensorName}`,
        `📌 ${data.location}`,
        `💧 Paras air: ${data.waterLevel} cm`,
    ];

    if (data.riseRate !== undefined && data.riseRate !== 0) {
        lines.push(`📈 Kadar naik: ${data.riseRate.toFixed(1)} cm/jam`);
    }

    if (data.batteryPct !== null && data.batteryPct !== undefined) {
        lines.push(`🔋 Bateri: ${data.batteryPct}%`);
    }

    if (data.temperatureC !== null && data.temperatureC !== undefined) {
        lines.push(`🌡️ Suhu: ${data.temperatureC}°C`);
    }

    if (data.rssiDbm !== null && data.rssiDbm !== undefined) {
        lines.push(`📶 Isyarat: ${data.rssiDbm} dBm`);
    }

    lines.push(``);

    if (isDanger) {
        lines.push(`⚡ SILA BERSEDIA UNTUK BERPINDAH.`);
    } else if (timeEstimate) {
        lines.push(timeEstimate);
    }

    lines.push(``, `🕐 ${new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`);

    const text = lines.join('\n');

    try {
        const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
            }),
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error('[Telegram] Failed to send:', res.status, errBody);
            return false;
        }

        console.log(`[Telegram] Alert sent: ${statusLabel} for ${data.sensorName}`);
        return true;
    } catch (err) {
        console.error('[Telegram] Network error:', err);
        return false;
    }
}

/**
 * Send a test/heartbeat message to verify Telegram is configured correctly.
 */
export async function sendTelegramTest(): Promise<{ success: boolean; error?: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        return { success: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in .env.local' };
    }

    try {
        const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: [
                    `✅ NADI Bencana — Telegram Connected`,
                    ``,
                    `Bot berjaya disambungkan ke sistem NADI.`,
                    `Anda akan menerima amaran banjir secara automatik.`,
                    ``,
                    `🕐 ${new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`,
                ].join('\n'),
            }),
        });

        if (!res.ok) {
            const errBody = await res.text();
            return { success: false, error: `Telegram API error: ${res.status} — ${errBody}` };
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Network error' };
    }
}
