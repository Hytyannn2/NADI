/**
 * Flood Thresholds — single source of truth
 *
 * Water level is always metres (`water_level` column), rise rate is always cm/hour
 * (`rise_rate_cm_hr` column). Used by the sensor API, Telegram alerts and the UI.
 *
 * Calibration knob: these must match WARNING_THRESHOLD_M / DANGER_THRESHOLD_M in
 * firmware/NADI_ESP32_Sonar/NADI_ESP32_Sonar.ino. They are the stage-demo values for
 * the 200 cm sonar rig; set them per site before a real river deployment.
 */

export const FLOOD_WARNING_M = 1.0;
export const FLOOD_DANGER_M = 1.6;

// A sensor silent for this long is shown as offline (firmware pings every 3 s).
export const SENSOR_STALE_MS = 60_000;

export type FloodStatus = 'safe' | 'warning' | 'danger';

export function floodStatus(levelM: number): FloodStatus {
    if (levelM >= FLOOD_DANGER_M) return 'danger';
    if (levelM >= FLOOD_WARNING_M) return 'warning';
    return 'safe';
}

// Hours until the danger level at the current rise rate; null if not rising, already there, or > 48 h away.
export function hoursToDanger(levelM: number, riseCmHr: number): number | null {
    if (!(riseCmHr > 0) || levelM >= FLOOD_DANGER_M) return null;
    const hours = ((FLOOD_DANGER_M - levelM) * 100) / riseCmHr;
    return hours < 48 ? hours : null;
}
