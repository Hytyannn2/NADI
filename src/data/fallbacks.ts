/**
 * Static Fallback Data
 * 
 * Provides fallback evacuation centers and historical flood risk zones
 * when offline or when database connectivity is unavailable.
 */

export interface FallbackPpsCenter {
  name: string;
  district: string;
  capacity: number;
  type: string;
  lat: number;
  lng: number;
}

export const FALLBACK_PPS_CENTERS: FallbackPpsCenter[] = [
  { name: 'SK Kubang Kerian', district: 'Kota Bharu', capacity: 500, type: 'Sekolah', lat: 6.092444, lng: 102.274583 },
  { name: 'Masjid Muhammadi', district: 'Kota Bharu', capacity: 800, type: 'Masjid', lat: 6.132155, lng: 102.236688 },
  { name: 'SK Kuala Krai', district: 'Kuala Krai', capacity: 400, type: 'Sekolah', lat: 5.534744, lng: 102.197519 },
  { name: 'SK Gua Musang', district: 'Gua Musang', capacity: 350, type: 'Sekolah', lat: 4.882100, lng: 101.964500 },
  { name: 'Dewan Sultan Tanah Merah', district: 'Tanah Merah', capacity: 300, type: 'Dewan', lat: 5.808300, lng: 102.148100 }
];

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
export const SEED_JOBS: any[] = [];
export const SEED_VENDORS: any[] = [];
export const REAL_JOBS: any[] = [];
export const REAL_VENDORS: any[] = [];
