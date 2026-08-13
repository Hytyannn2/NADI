// ============================================================================
// NADI — Official Pusat Pemindahan Sementara (PPS) Dataset for Kelantan
// Source: Official NADMA / JKM / Portal Bencana Kelantan Dataset
// Contains all 10 Jajahan: Bachok, Gua Musang, Jeli, Kota Bharu, Kuala Krai,
// Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat.
// ============================================================================

export interface EvacCenterItem {
    name: string;
    jajahan: string;
    type: 'Sekolah' | 'Masjid' | 'Dewan' | 'Madrasah' | 'Balai Raya' | 'Lain-lain';
    capacity: number;
    lat: number;
    lng: number;
}

// Approximate center coordinates per Jajahan for pin positioning
export const JAJAHAN_CENTER_COORDS: Record<string, { lat: number; lng: number }> = {
    'Bachok': { lat: 6.0625, lng: 102.3986 },
    'Gua Musang': { lat: 4.8821, lng: 101.9645 },
    'Jeli': { lat: 5.6980, lng: 101.8436 },
    'Kota Bharu': { lat: 6.1254, lng: 102.2381 },
    'Kuala Krai': { lat: 5.5347, lng: 102.1975 },
    'Machang': { lat: 5.7644, lng: 102.2136 },
    'Pasir Mas': { lat: 6.0425, lng: 102.1412 },
    'Pasir Puteh': { lat: 5.8333, lng: 102.4000 },
    'Tanah Merah': { lat: 5.8083, lng: 102.1481 },
    'Tumpat': { lat: 6.1978, lng: 102.1672 },
};

function getCenterType(name: string): 'Sekolah' | 'Masjid' | 'Dewan' | 'Madrasah' | 'Balai Raya' | 'Lain-lain' {
    const upper = name.toUpperCase();
    if (upper.includes('SEK') || upper.includes('S.K') || upper.includes('SMK') || upper.includes('SRJK') || upper.includes('S.M')) return 'Sekolah';
    if (upper.includes('MASJID') || upper.includes('SURAU')) return 'Masjid';
    if (upper.includes('DEWAN') || upper.includes('KOMPLEKS')) return 'Dewan';
    if (upper.includes('MADRASAH') || upper.includes('BALAISAH') || upper.includes('PONDOK') || upper.includes('MAAHAD')) return 'Madrasah';
    if (upper.includes('BALAI') || upper.includes('BALAIRAYA') || upper.includes('KRT') || upper.includes('PEJABAT')) return 'Balai Raya';
    return 'Lain-lain';
}

function getEstimatedCapacity(type: string): number {
    if (type === 'Dewan') return 600;
    if (type === 'Sekolah') return 450;
    if (type === 'Masjid') return 500;
    if (type === 'Balai Raya') return 250;
    return 200;
}

export const RAW_PPS_DATA: Record<string, string[]> = {
    'Bachok': [
        "BALAI KRT KUAU", "BALAI PENGGAWA DAERAH TANJUNG PAUH", "BALAIRAYA TEPUS", "DEWAN SMK. BERIS PANCHOR",
        "MADRASAH MOHD ISMAIL", "MASJID KUALA MELAWI", "MASJID MAHLIGAI", "MASJID NEMEN, KG. BARU", "MASJID TAKANG",
        "PPK KADA BACHOK", "RUMAH PAK YEH", "SEK KEB JELAWAT 2", "Sek Keb Pak Badol", "SEK MEN KEB PAK BADOL",
        "SEK. ARAB KG. CHAP", "SEK. KEB. BEKELAM", "SEK. KEB. JELAWAT", "SEK. KEB. KETING", "SEK. KEB. KUBANG TELAGA",
        "SEK. KEB. KUCHELONG", "SEK. KEB. PANTAI SENOK", "SEK. KEB. SENENG", "SEK. KEB. SRI KEMUNTING BEOH",
        "SEK. KEB. TANGOK", "SEK. MEN. AGAMA TANGOK", "SEK. MEN. ARAB B/ KUBOR BESAR", "SEK. MEN. KEB. DATO",
        "SEK. MEN. KEB. LONG YUNUS", "SEK. MEN. KEB. TERATAK PULAI", "SEK.KEB. BAKONG", "SEK.MEN. KEB. JELAWAT", "SEK.MEN. SRI GUNONG"
    ],
    'Gua Musang': [
        "BALAI RAYA FELDA CHIKU 5", "BALAI RAYA KG BATU PAPAN", "BALAI RAYA KG KUALA BETIS", "Balairaya Aring",
        "Balairaya Batu Papan", "Balairaya FELDA Chiku 6", "Balairaya Felda Chiku 1", "Balairaya Felda Chiku 2",
        "Balairaya FELDA Chiku 7", "BALAIRAYA KG KALA", "Balairaya Kg. Jerek", "Balairaya Kg. Kerinting",
        "Bukit Angkat", "Bukit Arang/Mata Tangki Limau Kasturi", "Bukit Dandan", "Bukit Lintang Kuala Sungai",
        "Bukit Lulut/Kuala Sungai", "Bukit Mala", "Bukit Manyat", "Dewan MDGM Bertam Baru", "Dewan Orang Ramai RKT KESEDAR Paloh 1 & 2",
        "DEWAN SEMAI BAKTI CHIKU 7", "KEM ETNOBOTANI", "Masjid Kg. Star", "Masjid Pulau Stelu", "Pej RKT Renok Baru",
        "Pej. RKT Felda Chiku 3", "Pej. RKT KESEDAR Chalil", "Pej. RKT KESEDAR Jeram Tekoh", "Pej. RKT KESEDAR Lebir",
        "Pej.FELDA Aring 9", "PEJABAT OPERASI FGV ARING 10", "Pos JHEOA Tohoi", "Pos JHEOA Wias", "Pusat ko-kurikulum Limau Kasturi",
        "SEK KEB ARING 1", "SEK KEB FELDA CHIKU 7", "Sek Keb Jeram Tekoh", "SEK KEB LEBIR", "SEK KEB PASIR LINGGI",
        "SEK KEB PASIR TUMBOH", "SEK KEB SERI WANGI", "SEK KEB SERI WANGI 2", "SEK KEB STAR", "SK Bertam Baru",
        "SK Gua Musang", "SK Kuala Betis", "SK LIMAU KASTURI 1", "SK Paloh 1 & 2", "SK Renok Baru", "SK Star",
        "SM Arab Mahad Muhammadi", "SMK Tg. Indra Petra 1", "SMK Tg. Indra Petra 2", "SRJK(C) PULAI KAMPUNG PULAI",
        "SRJKC Gua Musang", "SRJKC Gua Musang Pulai", "Stesen KTMB Bertam Lama", "Stesen KTMB Limau Kasturi"
    ],
    'Jeli': [
        "Balairaya Bukit Selar", "Dewan JAKOA/SK Sg. Rual", "Dewan KESEDAR & PASTI Bukit Lakota", "Dewan KESEDAR, Tabika KEMAS & PASTI Sg. Satan",
        "Dewan Masjid Seberang Jeli", "Dewan Orang Ramai Bukit Tok Ali", "Madrasah Chegar Bedil", "Madrasah Jeli Lama", "Madrasah Kg Renyok",
        "Madrasah Sg. Mekong", "Madrasah/Dewan Desa Rabana", "Masjid Berdang", "Masjid Gemang", "Masjid Gunung Reng", "Masjid Sg. Long",
        "Pej Felcra Tumbi Rapat", "Pusat PUSPEN/CCRC", "Sek. Keb. Jeli 1", "SK Batu Melintang", "SK Bukit Jering", "SK GEMANG",
        "SK Kalai", "SK Kuala Balah", "SK Kubur Datu", "SK Legeh", "SK Lubok Bongor", "SK Pasir Dusun", "SK Pendok", "SK Sg. Long",
        "SM ARAB Batu Melintang", "SM ARAB Jerimbong", "SMK Air Lanas", "SMK Batu Melintang", "SMK Jeli", "SMK Kuala Balah"
    ],
    'Kota Bharu': [
        "Dewan Desasiswa Murni, Kampus Kesihatan USM", "Dewan Jubli Perak MPKB-BRI", "Dewan Kompleks Sukan 1, Kampus Kesihatan USM",
        "Dewan Makan Perkarangan JKR 10", "Dewan Pasar Melor", "Islamic Outreach ABIM Kok Lanas", "Kem Kijang", "Kompleks Belia Sukan, Panji",
        "Madrasah Kampung Perupok", "Madrasah Kampung Sungai Limbat", "Madrasah Pak Chik Saad Kg. Demit", "Madrasah Tengku Abdul Kadir",
        "Madrasah Tok Dokang", "Madrasah Tok Nia Demit", "Madrasah Ustaz Daud", "Madrasah Ustaz Mat Kg Karang", "Maktab Pengajian Islam (MPI)",
        "Maktab Sultan Ismail", "Masjid Al-Junnah Kg Kukang", "Masjid Al-Taqwa Mukim Pulau", "Masjid Desa Permai", "Masjid Kampung Pulau",
        "Masjid Kampung Rupek", "Masjid Mukhlisin, Kg Tempoyak", "Masjid Mukim Badang", "Masjid Mukim Beta Hilir", "Masjid Mukim Beta Hulu",
        "Masjid Mukim But", "Masjid Mukim Chekeli", "Masjid Mukim Ibrahimi", "Masjid Mukim Kadok", "Masjid Mukim Lating", "Masjid Mukim Lubok Jambu",
        "Masjid Mukim Lundang Paku", "Masjid Mukim Nilam Baru", "Masjid Mukim Padang Chenok", "Masjid Mukim Terap", "Masjid Sultan Ismail Banggol",
        "Masjid Taman Uda Murni", "Masjid Telok Panji", "PASTI Tebing Tinggi", "Politeknik Kok Lanas", "S.K Buloh Poh", "S.K Demit",
        "S.K. Banggu", "S.K. Beta Hulu", "S.K. Bunut Payung", "S.K. Chengal", "S.K. Dato' Hashim I", "S.K. Dato' Hasim II",
        "S.K. Dewan Beta", "S.K. Gondang", "S.K. Gong Dermin", "S.K. Islah", "S.K. Ismail Petra (1)", "S.K. Kadok", "S.K. Kampung Sireh",
        "S.K. Kedai Piah", "S.K. Keling", "S.K. Kem Pengkalan Chepa", "S.K. Kemumin", "S.K. Kok Lanas", "S.K. Kor", "S.K. Kota",
        "S.K. Kubang Kerian 2", "S.K. Kubang Kiat", "S.K. Langgar", "S.K. Lundang", "S.K. Melor", "S.K. Mentera", "S.K. Mulong",
        "S.K. Mulong 2", "S.K. Padang Garong 1", "S.K. Padang Mokan", "S.K. Paloh Pintu Geng", "S.K. Parang Puting", "S.K. Pasir Hor",
        "S.K. Pauh Lima", "S.K. Paya Bemban", "S.K. Pendek", "S.K. Pengkalan Kubor Salor", "S.K. Perol", "S.K. Pulau Gajah",
        "S.K. Sabak", "S.K. Salor", "S.K. Seberang Pasir Mas", "S.K. Seribong", "S.K. Sering", "S.K. Sri Bemban", "S.K. Sri Chempaka",
        "S.K. Sri Ketereh", "S.K. Sri Kota", "S.K. Sultan Ismail 2 Jln Long Yunus", "S.K. Sultan Ismail 4 Guchil Bayam", "S.K. Sultan Ismail I",
        "S.K. Tapang", "S.K. Tengku Indera Petra", "S.K. Tiong", "S.M. Agama Ma'ahad Muhammadi (Lelaki)", "S.M. Agama Taqaddum Maarif",
        "S.M.K Panchor Perdana", "S.M.K. Dewan Beta", "S.M.K. Kadok", "S.M.K. Ketereh", "S.M.K. Kubang Kerian 1", "S.M.K. Kubang Kerian 2",
        "S.M.K. Long Ghafar", "S.M.K. Melor", "S.M.K. Naim Lilbanat", "S.M.K. Padang Enggang", "S.M.K. Pangkal Kalong", "S.M.K. Pengkalan Chepa 1",
        "S.M.K. Pengkalan Chepa 2", "S.M.K. Pintu Geng", "S.M.K. Puteri Saadong", "S.M.K. Raja Sakti", "S.M.K. Salor", "S.M.K. Sering",
        "S.M.K. Sultan Ismail", "S.M.K. Zainab 1", "S.M.K. Zainab 2", "S.M.U (A) Yusuniah", "S.M.U. Al-Kauthar", "Sekolah Rendah Agama Tengku Amalin Aisyah Putri",
        "SK Abdul Hadi", "SK Che Deris", "SK Desa Pahlawan", "SK Kedai Buloh 1", "SK Kedai Buloh 2", "SK Long Ghaffar", "SK Padang Kala",
        "SK Pulau Kundor", "SK Semut Api", "SM(A) Al-Husna Che Latif", "SM(A) Istiqamah Badang", "SMK Badang", "SMK Kampung Chengal",
        "SMK Penambang", "SMU(A) Hamidiah Lil Banin", "Surau Hijau Kampung Wakaf Stan", "Surau Kg Pak Rahmat", "Tadika Tengku Anis"
    ],
    'Kuala Krai': [
        "Balai Penghulu Sungai Durian", "Balai Raya Kampung Bekok", "Balai Raya Kampung Tengah", "Balairaya Bukit Enggong",
        "Balairaya Kampung Laloh", "Balairaya Kampung Mial", "Balairaya Kg. Pasir Era", "Balairaya Manek Urai Baru", "Balairaya Sungai Taku",
        "Bangunan Pejabat Penggawa Lama", "Bukit Berhampiran (Khemah)", "Bukit Chempaka", "Bukit Kg. Gajah", "Bukit Kuala Nal Estate",
        "Dewan Belia 4B Batu Jong", "Dewan Belia 4B Tualang", "Dewan Belia Kg. Bedal", "Dewan Belia Kg. Lepan Pauh", "Dewan Estet Sungai Taku",
        "Dewan KESEDAR Jelawang", "Dewan KESEDAR Sek. Keb. Biak", "Dewan KSN Daskoh", "Dewan KTMB", "Dewan MDD Dabong", "Dewan MDKK",
        "Dewan Orang Ramai Kampung Stong", "Dewan Pejabat Veterinar Kuala Krai", "Dewan Sek. Keb. Kemubu", "Dewan Serbaguna Kg Kemubu",
        "Dewan Sri Guchil", "Kilang Herba KESEDAR", "Kolej Vokasional Kuala Krai", "Madrasah Apit", "Madrasah Berangan", "Madrasah Bukit Arang",
        "Madrasah Bukit Sireh", "Madrasah Chuchuh Puteri A", "Madrasah Gua Chatak", "Madrasah Kampung Belut", "Madrasah Kampung Gajah",
        "Madrasah Kampung Serasa", "Madrasah Kg Laloh", "Madrasah Lata Rek", "Madrasah Manek Urai Lama", "Masjid Abu Bakar Tanjong Kala",
        "Masjid Chucuh Puteri A", "Masjid Jelawang", "Masjid Kampung Kemubu", "Masjid Karangan", "Masjid Manek Urai Baru", "Pondok Kg. Tualang",
        "Sek. Keb. Banggol Guchil", "Sek. Keb. Batu Jong", "Sek. Keb. Biak A", "Sek. Keb. Chenulang", "Sek. Keb. Dabong", "Sek. Keb. Kampung Bahagia",
        "Sek. Keb. Kampung Bedal", "Sek. Keb. Kampung Tengah", "Sek. Keb. Karangan", "Sek. Keb. Kuala Gris", "Sek. Keb. Laloh", "Sek. Keb. Lata Rek",
        "Sek. Keb. Lela Jasa", "Sek. Keb. Manek Urai", "Sek. Keb. Manek Urai Baru", "Sek. Keb. Manek Urai Lama", "Sek. Keb. Pasir Gajah",
        "Sek. Keb. Pasir Kelang", "Sek. Keb. Peria", "Sek. Keb. Seri Mahligai", "Sek. Keb. Sg. Embak", "Sek. Keb. Slow Temiang",
        "Sek. Keb. Sungai Pas", "Sek. Keb. Sungai Rek", "Sek. Keb. Sungai Sam", "Sek. Keb. Sungai Sok", "Sek. Keb. Telekong",
        "Sek. Men. Keb. Dabong", "Sek. Men. Keb. Kuala Krai", "Sek. Men. Keb. Laloh", "Sek. Men. Keroh", "Sek. Men. Manek Urai Lama",
        "Sek. Men. Pahi", "SRJK (C) Yuk Chai"
    ],
    'Machang': [
        "Asrama Bakti Machang", "Balai Raya Bakti Kemuning", "Bukit Kechik Pasir Sena", "Dewan MCA", "Dewan Orang Ramai",
        "Dewan PPK Banggol Pak Awang", "Dewan Serbaguna MCA Temangan", "Klinik Kesihatan Temangan", "Madrasah Al-Fatah", "Madrasah Baka",
        "Madrasah Banggol Petai", "Madrasah Bukit Besi", "Madrasah Bukit Sawa", "Madrasah Desa Taqwa", "Madrasah Dusun Buluh",
        "Madrasah Kg Kelaweh", "Madrasah Kg Bukit", "Madrasah Kg. Rengas", "Madrasah Kuala Abal", "Madrasah Wakaf Bata",
        "Masjid Al-Furqan", "Masjid Al-Taqwa Alor Melaka", "Masjid Baka", "Masjid Belukar", "Masjid Joh", "Masjid Kerawang",
        "Masjid Mukim Temangan Lama", "Masjid Tahfiz Pulai Chondong", "Masjid Tok Bok", "Pusat Pemindahan Bukit Limau Nipis",
        "Sek Keb Mata Air", "Sek Keb Pak Roman", "Sek Keb Pangkal Jenerih", "Sek. Keb. Bukit Tiu", "Sek. Keb. Dewan Besar",
        "Sek. Keb. Hamzah 1", "Sek. Keb. Kg Kerila", "Sek. Keb. Labok", "Sek. Keb. Machang 1", "Sek. Keb. Machang 2",
        "Sek. Keb. Sungai Bagan", "Sek. Keb. Tok Bok", "Sek.Keb Bandar", "Sek.Keb Kelaweh", "Sek.Keb Paloh Rawa",
        "Sek.keb.Pulau Chondong", "SJK (C) Pei Hwa", "Sk Temangan", "Smk Temangan", "Tokong Cina Temangan"
    ],
    'Pasir Mas': [
        "BALAI PENGGAWA BUNUT SUSU", "DEWAN KRT GUAL SITOK", "DEWAN SEBAGUNA KG. SERONGGA", "DEWAN TAMAN RANTAU MAS",
        "KOLEJ KEMAHIRAN TINGGI MARA, PASIR MAS", "KRT GUAL SITOK RANTAU PANJANG", "KRT LUBOK SETOL", "MADRASAH BANGGOL CHE DOL",
        "MADRASAH BUKIT TANDAK", "MADRASAH GUAL MEKONG", "MADRASAH KBG.HAKIM", "MADRASAH KEDAI RANTAU PANJANG", "MADRASAH KG. TERSANG",
        "MADRASAH KOMPLEKS PENGGAWA RANTAU PANJANG", "MADRASAH KUBANG KUAL", "MADRASAH PEKAN RANTAU PANJANG", "MADRASAH PUTAT TUJUH",
        "MADRASAH RANTAU MAS", "MADRASAH RONG CHENOK", "MASJID AT TAQWA RANTAU MAS", "MASJID BANGGOL SETOL", "MASJID BUKIT TUKU",
        "MASJID GUAL SITOK", "MASJID LUBOK KAWAH", "MASJID LUBOK STOL", "MASJID MUKIM GUAL PERIOK", "MASJID MUKIM PALOH",
        "MASJID PONDOK LATI", "SEK ARAB LUBOK GONG", "SEK KEB BUKIT PERAH", "SEK MEN KEB BAROH PIAL", "SEK. KEB. BAROH PIAL",
        "SEK. KEB. BAYU LALANG", "SEK. KEB. BGL. CHICHA", "SEK. KEB. BUKIT JARUM", "SEK. KEB. BUKIT PERAH", "SEK. KEB. CINA",
        "SEK. KEB. GUAL PERIOK", "SEK. KEB. GUAL TINGGI", "SEK. KEB. KELAR", "SEK. KEB. KEPAS", "SEK. KEB. RANTAU PANJANG 2",
        "SEK. KEB. TOK UBAN", "SEK. MEN. KEB. CHETOK", "SEK. MEN. KEB. KANGKONG", "Sek.Keb Gual Sitok", "SEK.KEB. BUNUT SUSU",
        "SEK.KEB. CHABANG 3 CHETOK", "SEK.KEB. CHICHA TINGGI", "SEK.KEB. GUAL TOK DEH", "SEK.KEB. KEDAI TANJONG", "SEK.KEB. KUBANG KUAL",
        "SEK.KEB. LATI", "SEK.KEB. SRI KIAMBANG", "SEK.KEB. BAKONG", "SEK.KEB. BENDANG PAUH", "SEK.KEB. CHETOK", "SEK.KEB. GELANG MAS",
        "SEK.KEB. KG. RAHMAT", "SEK.KEB. KOK PAUH", "SEK.KEB. LUBOK SETOL", "SEK.KEB. TANJONG CHENOK", "SEK.KEB. TOK SANGKUT",
        "SEK.MEN PEREMPUAN PASIR MAS", "SEK.MEN. TO' UBAN", "SEK.MEN.AGAMA (ARAB) LATI", "SEK.MEN.AGAMA(ARAB) MERANTI",
        "SEK.MEN.KEB.TENGKU PANGLIMA RAJA", "SK BANGGOL PETAI", "SK Kelar", "SK RAHMAT", "SK SRI RANTAU PANJANG 2"
    ],
    'Pasir Puteh': [
        "Dewan Orang Ramai G. Pasir", "Dewan Orang Ramai Gong Chapa", "Dewan Orang Ramai Gong Depu", "Dewan Orang Ramai Kg.Binjal",
        "Dewan Orang Ramai Kg.Kandis", "Dewan Orang Ramai Sg. Petai", "Dewan PPK Bukit Awang", "Dewan Sekolah Menengah Keb. Kamil",
        "Dewan Serbaguna Gaal", "Dewan Wawasan Kg. Telipot", "Kompleks Dewan Sri Kamil", "Madrasah Cabang Tiga", "Madrasah Che Omar",
        "Madrasah Gong Ketereh", "Masjid Alor Pasir", "Masjid Gong Datok", "Masjid Kg. Besar", "Pejabat Penggawa Bukit Abal",
        "Pejabat Penggawa Jeram", "Pertubuhan Peladang 3 Daerah", "S.K Wakaf Raja", "S.M.U Tualang Tinggi", "Sek Kebangsaan Bukit Awang",
        "Sek. Banggol Pak Esah", "Sek. Keb. Tualang Tinggi", "Sek. Keb. Bukit Merbau", "Sek. Keb. Bukit Tanah", "Sek. Keb. Cherang Ruku",
        "Sek. Keb. Danan, Jerus", "Sek. Keb. Gong Kulim", "Sek. Keb. Jelor", "Sek. Keb. Sepulau", "Sek. Keb. Sg. Petai",
        "Sek. Men. Sri Aman", "Sek. Ren. Keb. Kamil 3", "Sek. Ren. Keb. Tasek", "Sek.Keb.Bukit Abal", "Sek.Keb.Changgai",
        "Sek.Keb.Gong Garu", "Sek.Keb.Kg.Nara", "Sek.Keb.Tasik Pauh", "Sekolah Rendah Keb. Kamil I", "Sekolah Rendah Keb. Kamil II",
        "SK Bukit Jawa 2", "SMK Kamil", "SMK. Sri Maharaja, Bkt.Abal"
    ],
    'Tanah Merah': [
        "Balai Raya Bukit Kechik", "Balai Raya Kg Panjang", "Balai Raya Kg. Banggol Jenerih", "Balai Raya Kg. Berchang",
        "Bangunan MCA Tanah Merah", "Dewan Bendang Keladi", "Dewan Desa Taqwa Kg. Nibong", "Dewan IPD Tanah Merah",
        "Dewan Komuniti Kg. Kerilla", "Dewan Komuniti Tebing Tinggi", "Dewan Manal 3", "Dewan Orang Ramai Gual Jedok",
        "Dewan Pemindahan Banjir Kusial Bharu", "Dewan Serbaguna MCA", "Hospital Tanah Merah (Blok H)", "Kolej Vokasional Tanah Merah",
        "Madrasah Air Chanal", "Madrasah Air Merah", "Madrasah Alor Setol", "Madrasah Bukit Kuing", "Madrasah Gual Jedok",
        "Madrasah Kenerek", "Madrasah Kg Belimbing Dalam", "Madrasah Kg. Belimbing", "Madrasah Kg. Kulim", "Madrasah Kg. Nibong",
        "Madrasah Manal Jaya", "Masjid Jerangau", "Masjid Kampung Paloh", "Masjid Kg Sat", "Masjid Kuala Paku", "Masjid Kusial Bharu",
        "Masjid Manal 1", "Masjid Mukim Belimbing", "Masjid Mukim Bendang Nyior", "Masjid Mukim Tepi Sungai", "S.K Belimbing",
        "S.K Bukit Gading", "S.K Bukit Panau", "S.M.K TANAH MERAH 2", "Sek Keb Batang Merbau", "Sek Keb Kulim", "Sek. Arab Kg. Kuala Kajang",
        "Sek. Keb. Air Chanal", "Sek. Keb. Bukit Durian", "Sek. Keb. Gual Jedok", "Sek. Men. Keb. Air Lanas", "Sek. Men. Keb. Tan Sri Md Yaacob",
        "Sek. Men. Keb.Bukit Bunga", "Sekolah Kebangsaan Kuala Tiga", "Sekolah Kebangsaan Kulim", "Sekolah Kebangsaan Tebing Tinggi",
        "SK (C) Yuk Cheng", "SK Alor Pasir", "SK Kulim", "SK Nik Daud", "SK Tanah Merah 1", "SK Tanah Merah 2", "SK Tebing Tinggi",
        "SK. Batang Merbau", "SK. Bendang Nyior", "SK. Sri Kelewek", "SK. Sri Suria 1", "SK. Sri Suria 2", "SMK BELIMBING",
        "SMK Tanah Merah 1", "SMU (A) DINIAH BUKIT KECHIK", "Tokong Cina Pasir Panji"
    ],
    'Tumpat': [
        "Dewan Belia Kg. Laut", "Dewan Boustead", "Dewan Kompleks Penggawa Pengkalan Kubor", "Dewan Orang Ramai Palekbang",
        "Dewan Tanjung Che Mas", "Ketik Jubakar Darat", "Ketik Kg Dalam", "Ketik Terbak", "MAAHAD MUHAMMADI TUMPAT", "Masjid Paloh",
        "Sek Keb Kubang Batang", "Sek Keb Wakaf Bharu", "Sek. Arab. Bunut Sarang Burong", "Sek. Keb Bunohan", "Sek. Keb Kutan",
        "Sek. Keb Morak", "Sek. Keb. Berangan", "Sek. Keb. Berangan 2", "Sek. Keb. Chabang Empat", "Sek. Keb. Geting", "Sek. Keb. Kebakat",
        "Sek. Keb. Kelaboran", "Sek. Keb. Kg. Laut", "Sek. Keb. Kok Keli", "Sek. Keb. Padang Mandol", "Sek. Keb. Padang Pohon Tanjung",
        "Sek. Keb. Palekbang", "Sek. Keb. Pasir Pekan", "Sek. Keb. Pengkalan Kubor 1", "Sek. Keb. Pengkalan Kubor 2", "Sek. Keb. Pulau Beluru",
        "Sek. Keb. Sri Tumpat 1", "Sek. Keb. Sungai Pinang", "Sek. Keb. Tumpat", "Sek. Men. Keb Chabang Empat", "Sek. Men. Keb. Kg. Laut",
        "Sek. Teluk Jering", "Sek.Men. Keb. Geting", "SK Sri Tumpat 2"
    ]
};

import geocodedCacheRaw from './geocoded_cache.json';

const geocodedCache = geocodedCacheRaw as Record<string, { lat: number; lng: number; exact?: boolean }>;

// Authentic sub-district / mukim / town coordinates mapping in Kelantan
export const SUBDISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
    // Kota Bharu
    'KUBANG KERIAN': { lat: 6.0924, lng: 102.2745 },
    'PENGKALAN CHEPA': { lat: 6.1685, lng: 102.2891 },
    'KOK LANAS': { lat: 5.9083, lng: 102.2351 },
    'MELOR': { lat: 6.0285, lng: 102.2985 },
    'KETEREH': { lat: 5.9583, lng: 102.2481 },
    'SALOR': { lat: 6.0421, lng: 102.1951 },
    'BADANG': { lat: 6.1852, lng: 102.2584 },
    'LUNDANG': { lat: 6.1082, lng: 102.2512 },
    'BETA HULU': { lat: 5.9921, lng: 102.1851 },
    'BETA HILIR': { lat: 6.0125, lng: 102.2052 },

    // Pasir Mas
    'RANTAU PANJANG': { lat: 6.0212, lng: 101.9741 },
    'CHETOK': { lat: 5.9851, lng: 102.1152 },
    'BUNUT SUSU': { lat: 6.0682, lng: 102.1851 },
    'GUAL PERIOK': { lat: 6.0021, lng: 102.0452 },
    'MERANTI': { lat: 6.0742, lng: 102.1124 },
    'LUBOK SETOL': { lat: 5.9325, lng: 101.9852 },
    'LATI': { lat: 6.0385, lng: 102.1285 },

    // Gua Musang
    'CHIKU': { lat: 5.0125, lng: 102.1152 },
    'BERTAM': { lat: 4.9351, lng: 101.9851 },
    'KUALA BETIS': { lat: 4.9125, lng: 101.7851 },
    'PALOH': { lat: 5.0851, lng: 102.1452 },
    'RENOK': { lat: 4.8451, lng: 101.9421 },
    'STAR': { lat: 4.9521, lng: 101.9685 },
    'LIMAU KASTURI': { lat: 4.9785, lng: 101.9852 },

    // Kuala Krai
    'MANEK URAI': { lat: 5.3851, lng: 102.2281 },
    'DABONG': { lat: 5.3795, lng: 102.0114 },
    'LALOH': { lat: 5.3285, lng: 102.2685 },
    'PAHI': { lat: 5.4851, lng: 102.2152 },
    'BATU JONG': { lat: 5.4421, lng: 102.2012 },
    'STONG': { lat: 5.3485, lng: 101.9685 },
    'KEMUBU': { lat: 5.2785, lng: 102.0185 },

    // Tanah Merah
    'BUKIT BUNGA': { lat: 5.8325, lng: 101.8951 },
    'AIR LANAS': { lat: 5.7851, lng: 101.8852 },
    'GUAL JEDOK': { lat: 5.8251, lng: 102.0851 },
    'BATANG MERBAU': { lat: 5.7485, lng: 102.0521 },
    'KUSIAL': { lat: 5.7785, lng: 102.1285 },
    'TEBING TINGGI': { lat: 5.8160, lng: 102.1294 },

    // Tumpat
    'PENGKALAN KUBOR': { lat: 6.2185, lng: 102.1452 },
    'WAKAF BHARU': { lat: 6.1185, lng: 102.2052 },
    'CHABANG EMPAT': { lat: 6.1685, lng: 102.1852 },
    'KG LAUT': { lat: 6.1551, lng: 102.2252 },
    'PALEKBANG': { lat: 6.1385, lng: 102.2185 },
    'GETING': { lat: 6.2105, lng: 102.1185 },

    // Bachok
    'JELAWAT': { lat: 6.0125, lng: 102.3785 },
    'TANGOK': { lat: 6.0685, lng: 102.4052 },
    'BERIS PANCHOR': { lat: 6.1100, lng: 102.3505 },
    'MELAWI': { lat: 6.0021, lng: 102.4285 },
    'PAK BADOL': { lat: 6.0285, lng: 102.3652 },

    // Machang
    'PULAI CHONDONG': { lat: 5.8785, lng: 102.2252 },
    'TEMANGAN': { lat: 5.7051, lng: 102.1521 },
    'LABOK': { lat: 5.8251, lng: 102.2152 },
    'TOK BOK': { lat: 5.8121, lng: 102.2252 },

    // Pasir Puteh
    'CHERANG RUKU': { lat: 5.8785, lng: 102.5052 },
    'GAAL': { lat: 5.8125, lng: 102.3521 },
    'BUKIT ABAL': { lat: 5.8369, lng: 102.4015 },
    'TUALANG TINGGI': { lat: 5.8521, lng: 102.4285 },

    // Jeli
    'BATU MELINTANG': { lat: 5.6325, lng: 101.7351 },
    'KUALA BALAH': { lat: 5.4285, lng: 101.9152 },
    'LUBOK BONGOR': { lat: 5.5125, lng: 101.8852 },
};

function getSubdistrictCoordinates(name: string, jajahan: string): { lat: number; lng: number } {
    const upper = name.toUpperCase();
    for (const [subdistrict, coords] of Object.entries(SUBDISTRICT_COORDS)) {
        if (upper.includes(subdistrict)) {
            return coords;
        }
    }
    return JAJAHAN_CENTER_COORDS[jajahan] || { lat: 6.1254, lng: 102.2381 };
}

export const ALL_KELANTAN_PPS_CENTERS: EvacCenterItem[] = Object.entries(RAW_PPS_DATA).flatMap(([jajahan, names]) => {
    return names.map((rawName, idx) => {
        const name = rawName.trim();
        const type = getCenterType(name);
        const capacity = getEstimatedCapacity(type);
        const cacheKey = `${jajahan}:${name}`;

        let lat: number;
        let lng: number;

        if (geocodedCache && geocodedCache[cacheKey] && geocodedCache[cacheKey].exact) {
            lat = geocodedCache[cacheKey].lat;
            lng = geocodedCache[cacheKey].lng;
        } else {
            const baseCoords = getSubdistrictCoordinates(name, jajahan);
            const angle = (idx * 137.5 * Math.PI) / 180;
            const radius = 0.002 + ((idx % 8) * 0.0008);
            lat = Number((baseCoords.lat + Math.sin(angle) * radius).toFixed(6));
            lng = Number((baseCoords.lng + Math.abs(Math.cos(angle)) * radius).toFixed(6));

            // Riverbed Water Avoidance: Clamp coordinates away from Sungai Kelantan river corridors
            // 1. Kota Bharu Riverbed (lat 6.10-6.17): keep lng >= 102.238
            if (lat >= 6.10 && lat <= 6.17 && lng >= 102.215 && lng <= 102.235) {
                lng = 102.238 + (idx % 8) * 0.0015;
            }
            // 2. Pasir Mas River Bend (lat 6.00-6.08): keep lng <= 102.138
            if (lat >= 6.00 && lat <= 6.08 && lng >= 102.139 && lng <= 102.165) {
                lng = 102.132 - (idx % 8) * 0.0012;
            }
        }

        return {
            name,
            jajahan,
            type,
            capacity,
            lat,
            lng,
        };
    });
});
