/**
 * Application Constants
 * 
 * Centralized default coordinates, IoT sensor identifiers, and regional districts.
 */

// Default fallback coordinates (Kota Bharu, Kelantan) when user GPS is unavailable
export const DEFAULT_LOCATION = {
  lat: 6.1254,
  lng: 102.2381,
  label: 'Kota Bharu',
  state: 'Kelantan',
} as const;

// Default primary IoT river sensor node name
export const DEFAULT_SENSOR_NODE = 'Sungai Kelantan Node A';

// The 10 official Kelantan administrative districts (Jajahan)
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
