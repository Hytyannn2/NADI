/**
 * Static Fallback Data
 * 
 * Provides historical flood risk zones and other static fallbacks
 * when offline or when database connectivity is unavailable.
 */

export interface FallbackFloodZone {
  name: string;
  center: [number, number];
  radius: number;
}

export const FALLBACK_FLOOD_ZONES: FallbackFloodZone[] = [
  { name: 'Cekungan Sungai Kelantan (Kota Bharu)', center: [6.1200, 102.2250], radius: 3200 },
  { name: 'Zon Limpahan Rantau Panjang (Sungai Golok)', center: [6.0212, 101.9741], radius: 4000 },
  { name: 'Zon Banjir Pasir Mas (Limpahan Sungai)', center: [6.0425, 102.1450], radius: 3500 },
  { name: 'Lembangan Sungai Kuala Krai', center: [5.5347, 102.1975], radius: 4500 },
];

export interface FallbackVendor {
  name: string;
  category: string;
  lat: number;
  lng: number;
  district: string;
}

export const FALLBACK_VENDORS: FallbackVendor[] = [];
