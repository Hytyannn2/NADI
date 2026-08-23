/**
 * Telegram Alert Notification Service
 *
 * Dispatches flood alert messages to a configured Telegram chat or channel.
 *
 * Setup:
 * 1. Create a bot via @BotFather and copy the API token.
 * 2. Add the bot to your channel/group and send a test message.
 * 3. Fetch your chat_id via https://api.telegram.org/bot<TOKEN>/getUpdates.
 * 4. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env.local.
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
    timeToDanger?: string;
}

/**
 * Sends a flood alert message to the configured Telegram chat.
 * Returns false if credentials are not configured or if delivery fails.
 */
export async function sendTelegramAlert(data: TelegramAlertData): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.log('[Telegram] Skipped — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
        return false;
    }

    const isDanger = data.status === 'danger';
    const icon = isDanger ? '' : '';
    const statusLabel = isDanger ? 'BAHAYA' : 'AMARAN AWAL';

    // Calculates estimated hours until water level reaches danger threshold (120 cm)
    const timeEstimate = data.riseRate && data.riseRate > 0 && data.waterLevel < 120
        ? ` Anggaran ${Math.max(1, Math.round((120 - data.waterLevel) / data.riseRate))} jam ke paras bahaya`
        : null;

    // Formats alert message in Malay for local community readability
    const lines: string[] = [
        `${icon} ${statusLabel} — JAGA KELANTAN`,
        ``,
        ` ${data.sensorName}`,
        ` ${data.location}`,
        ` Paras air: ${data.waterLevel} cm`,
    ];

    if (data.riseRate !== undefined && data.riseRate !== 0) {
        lines.push(` Kadar naik: ${data.riseRate.toFixed(1)} cm/jam`);
    }

    if (data.batteryPct !== null && data.batteryPct !== undefined) {
        lines.push(` Bateri: ${data.batteryPct}%`);
    }

    if (data.temperatureC !== null && data.temperatureC !== undefined) {
        lines.push(` Suhu: ${data.temperatureC}°C`);
    }

    if (data.rssiDbm !== null && data.rssiDbm !== undefined) {
        lines.push(` Isyarat: ${data.rssiDbm} dBm`);
    }

    lines.push(``);

    if (isDanger) {
        lines.push(` SILA BERSEDIA UNTUK BERPINDAH.`);
    } else if (timeEstimate) {
        lines.push(timeEstimate);
    }

    lines.push(``, ` ${new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`);

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
 * Sends a test heartbeat to confirm that Telegram bot credentials are working.
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
                    ` NADI Bencana — Telegram Connected`,
                    ``,
                    `Bot berjaya disambungkan ke sistem NADI.`,
                    `Anda akan menerima amaran banjir secara automatik.`,
                    ``,
                    ` ${new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`,
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
