/**
 * Application Constants
 * 
 * Centralized default coordinates, IoT sensor identifiers, and regional districts.
 */

// Default primary IoT river sensor node name and coordinates (Jambatan Sultan Yahya Petra)
export const DEFAULT_SENSOR_NODE = 'Sungai Kelantan Node A';
export const DEFAULT_SENSOR_LOCATION = {
  lat: 6.116459809420322,
  lng: 102.22825008905949,
  name: 'Sungai Kelantan Node A',
  locationName: 'Jambatan Sultan Yahya Petra',
  district: 'Kota Bharu',
  loraRadiusMeters: 3000,     // Reliable coverage radius (~3.0 km)
  loraMaxRadiusMeters: 5000,  // Extended line-of-sight river corridor radius (~5.0 km)
} as const;

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
