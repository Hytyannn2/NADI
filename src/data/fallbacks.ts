// ============================================================================
// NADI — Centralised Static Fallback & Seed Data
// Used gracefully when offline, or during cold starts before API/DB sync.
// ============================================================================

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

export const FALLBACK_VENDORS: FallbackVendor[] = [
  { name: 'Warung Nasi Ulam Cikgu', category: 'Makanan & Minuman', lat: 6.1280, lng: 102.2370, district: 'Kota Bharu' },
  { name: 'Kedai Runcit Pak Mat', category: 'Runcit & Bekalan', lat: 6.0450, lng: 102.1410, district: 'Pasir Mas' },
  { name: 'Batik Canting Kak Jah', category: 'Kraf Tangan', lat: 6.1220, lng: 102.2410, district: 'Kota Bharu' },
  { name: 'Kedai Serbaneka Pasar Siti Khadijah', category: 'Bekalan Makanan', lat: 6.1305, lng: 102.2388, district: 'Kota Bharu' },
  { name: 'Depot Tabung Gas Pasir Puteh', category: 'Bekalan Asas', lat: 5.8340, lng: 102.4010, district: 'Pasir Puteh' },
];

export const SEED_JOBS = [
  {
    id: 'j1',
    title: 'Pembantu Kedai Runcit',
    employer: 'Kedai Runcit Mak Cik Zah',
    location: 'Kubang Kerian',
    wageMYR: 8.50,
    wageType: 'hourly',
    category: 'retail',
    postedAt: Date.now() - 86400000,
    whatsapp: '60179876543',
    description: 'Mencari pekerja sambilan untuk membantu di kedai runcit. Waktu fleksibel.',
    isFairWage: true
  },
  {
    id: 'j2',
    title: 'Tukang Masak Nasi Kerabu',
    employer: 'Warung Kak Ani',
    location: 'Kota Bharu',
    wageMYR: 60,
    wageType: 'daily',
    category: 'f&b',
    postedAt: Date.now() - 172800000,
    whatsapp: '60121234567',
    description: 'Perlukan tukang masak berpengalaman untuk waktu pagi (6AM-12PM).',
    isFairWage: true
  },
  {
    id: 'j3',
    title: 'Pemandu Grab/e-Hailing',
    employer: 'Grab Kelantan Hub',
    location: 'Kota Bharu',
    wageMYR: 2800,
    wageType: 'monthly',
    category: 'transport',
    postedAt: Date.now() - 259200000,
    description: 'Pendapatan anggaran RM2,800/bulan. Kereta sendiri diperlukan.',
    isFairWage: true
  },
];

export const SEED_VENDORS = [
  {
    id: 'v1',
    name: 'Keropok Lekor Mak Su',
    category: 'Makanan',
    location: 'Pantai Cahaya Bulan',
    description: 'Keropok lekor asli Terengganu, goreng panas setiap hari.',
    whatsapp: '60171234567',
    rating: 4.8,
    reviews: 142,
    operatingHours: '8AM - 6PM'
  },
  {
    id: 'v2',
    name: 'Batik Canting Kak Jah',
    category: 'Kraf Tangan',
    location: 'Kampung Kraftangan',
    description: 'Batik lukis tangan asli Kelantan. Tempahan khas untuk majlis.',
    whatsapp: '60129876543',
    rating: 4.9,
    reviews: 87,
    operatingHours: '9AM - 5PM'
  },
];
