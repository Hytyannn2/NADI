// ============================================================================
// NADI — Centralised Application Constants
// Single source of truth for default values used across the entire platform.
// ============================================================================

/** Default geo-coordinates (Kota Bharu, Kelantan) used when GPS is unavailable */
export const DEFAULT_LOCATION = {
  lat: 6.1254,
  lng: 102.2381,
  label: 'Kota Bharu',
  state: 'Kelantan',
} as const;

/** Default IoT sensor node name (primary Supabase filter for BencanaView & CivicHeatMap) */
export const DEFAULT_SENSOR_NODE = 'Sungai Kelantan Node A';

/** All 10 Kelantan Jajahan (districts) — derives from kelantanPpsCenters.ts JAJAHAN_CENTER_COORDS */
export const KELANTAN_JAJAHAN = [
  'Kota Bharu',
  'Pasir Mas',
  'Tumpat',
  'Bachok',
  'Pasir Puteh',
  'Machang',
  'Tanah Merah',
  'Kuala Krai',
  'Jeli',
  'Gua Musang',
] as const;

export type KelantanJajahan = (typeof KELANTAN_JAJAHAN)[number];
