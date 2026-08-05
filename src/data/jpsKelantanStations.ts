export interface JpsStation {
    id: string;
    name: string;
    district: string;
    mainBasin: string;
    subBasin: string;
    /** Latest water level reading in metres */
    level: number | null;
    /** JPS official threshold levels in metres */
    normal: number;
    alert: number;
    warning: number;
    danger: number;
}

/**
 * Official JPS Kelantan River Telemetry Stations
 * Source: JPS iPublic InfoBanjir (publicinfobanjir.water.gov.my)
 * 31 stations across 10 districts
 *
 * Our NADI "Sungai Kelantan Node A" sensor is co-located with
 * station #26 — Sg. Kelantan di Tambatan D'Raja (0730671WL), Kota Bharu
 */
export const JPS_KELANTAN_STATIONS: JpsStation[] = [
    // === GUA MUSANG (5 stations) ===
    { id: "0730891WL", name: "Sg. Nenggiri di Belatop (F1)", district: "Gua Musang", mainBasin: "Sungai Kelantan", subBasin: "Sg. Nenggiri", level: 612.80, normal: 605.50, alert: 676.00, warning: 678.00, danger: 680.00 },
    { id: "0730811WL", name: "Sg. Galas di Kg. Pulai (F1)", district: "Gua Musang", mainBasin: "Sungai Kelantan", subBasin: "Sg. Galas", level: 102.80, normal: 107.80, alert: 108.10, warning: 108.90, danger: 109.70 },
    { id: "0730851WL", name: "Sg. Galas di Kg. Lembaga (F1)", district: "Gua Musang", mainBasin: "Sungai Kelantan", subBasin: "Sg. Galas", level: 82.92, normal: 82.40, alert: 83.70, warning: 85.60, danger: 87.90 },
    { id: "0731531WL", name: "Sg. Lebir di Kuala Koh (F1)", district: "Gua Musang", mainBasin: "Sungai Kelantan", subBasin: "Sg. Lebir", level: 62.82, normal: 62.00, alert: 67.00, warning: 71.00, danger: 75.00 },
    { id: "0730931WL", name: "Sg. Galas di Limau Kasturi (F1)", district: "Gua Musang", mainBasin: "Sungai Kelantan", subBasin: "Sg. Galas", level: 54.44, normal: 53.00, alert: 56.00, warning: 60.00, danger: 61.00 },

    // === GUA MUSANG / NENGGIRI ===
    { id: "0730831WL", name: "Sg. Nenggiri di Bertam (F1)", district: "Gua Musang", mainBasin: "Sungai Kelantan", subBasin: "Sg. Nenggiri", level: 47.50, normal: 50.40, alert: 53.70, warning: 55.20, danger: 58.10 },

    // === KUALA KRAI (7 stations) ===
    { id: "0730871WL", name: "Sg. Galas di Dabong (F1)", district: "Kuala Krai", mainBasin: "Sungai Kelantan", subBasin: "Sg. Galas", level: 27.84, normal: 28.00, alert: 35.00, warning: 37.00, danger: 38.00 },
    { id: "0730971WL", name: "Sg. Lebir di Kg. Tualang (F1)", district: "Kuala Krai", mainBasin: "Sungai Kelantan", subBasin: "Sg. Lebir", level: 24.01, normal: 23.00, alert: 30.00, warning: 34.00, danger: 35.00 },
    { id: "0730761WL", name: "Sg. Lebir di Kg. Karangan (F1)", district: "Kuala Krai", mainBasin: "Sungai Kelantan", subBasin: "Sg. Lebir", level: 21.58, normal: 19.00, alert: 27.00, warning: 33.00, danger: 34.00 },
    { id: "0730972WL", name: "Sg. Lebir di Kg. Manik Urai (F1)", district: "Kuala Krai", mainBasin: "Sungai Kelantan", subBasin: "Sg. Lebir", level: 19.97, normal: 19.10, alert: 30.00, warning: 32.00, danger: 33.00 },
    { id: "0730981WL", name: "Sg. Pahi di Kg. Pahi (F1)", district: "Kuala Krai", mainBasin: "Sungai Kelantan", subBasin: "Sg. Lebir", level: 19.41, normal: 17.80, alert: 26.00, warning: 30.00, danger: 32.00 },
    { id: "0730681WL", name: "Sg. Kelantan di Kuala Krai (F1)", district: "Kuala Krai", mainBasin: "Sungai Kelantan", subBasin: "Sg. Kelantan", level: 16.88, normal: 17.00, alert: 20.00, warning: 22.50, danger: 25.00 },
    { id: "0730921WL", name: "Sg. Nal di Kg. Sungai Nal (F1)", district: "Kuala Krai", mainBasin: "Sungai Kelantan", subBasin: "Sg. Nal", level: 18.30, normal: 21.00, alert: 23.50, warning: 24.00, danger: 25.00 },

    // === JELI (3 stations) ===
    { id: "0731211WL", name: "Sg. Pergau di Kg. Lawar (F1)", district: "Jeli", mainBasin: "Sungai Kelantan", subBasin: "Sg. Pergau", level: 99.58, normal: 95.00, alert: 101.00, warning: 102.00, danger: 103.00 },
    { id: "0731241WL", name: "Sg. Pergau di Air Bol (F1)", district: "Jeli", mainBasin: "Sungai Kelantan", subBasin: "Sg. Pergau", level: null, normal: 70.00, alert: 71.30, warning: 73.00, danger: 74.70 },
    { id: "0740151WL", name: "Sg. Lanas di Air Lanas (F1)", district: "Jeli", mainBasin: "Sungai Golok", subBasin: "Sg. Lanas", level: 25.05, normal: 27.00, alert: 28.50, warning: 29.00, danger: 29.50 },

    // === TANAH MERAH (3 stations) ===
    { id: "0731381WL", name: "Sg. Kelantan di Kusial Baru (F1)", district: "Tanah Merah", mainBasin: "Sungai Kelantan", subBasin: "Sg. Kelantan", level: 7.41, normal: 7.00, alert: 12.00, warning: 14.00, danger: 16.00 },
    { id: "0731371WL", name: "Sg. Kelantan di Kusial (F1)", district: "Tanah Merah", mainBasin: "Sungai Kelantan", subBasin: "Sg. Kelantan", level: 7.55, normal: 7.00, alert: 12.00, warning: 14.00, danger: 16.00 },
    { id: "0740261WL", name: "Sg. Golok di Kg. Jenob (F1)", district: "Tanah Merah", mainBasin: "Sungai Golok", subBasin: "Sg. Golok", level: 18.56, normal: 19.00, alert: 21.50, warning: 22.50, danger: 23.50 },

    // === MACHANG (1 station) ===
    { id: "0731361WL", name: "Sg. Kelantan di Kg. Temangan (F1)", district: "Machang", mainBasin: "Sungai Kelantan", subBasin: "Sg. Kelantan", level: 9.57, normal: 12.00, alert: 14.00, warning: 15.50, danger: 17.50 },

    // === PASIR MAS (4 stations) ===
    { id: "0730103WL", name: "Sg. Kelantan di Air Mulih (F1)", district: "Pasir Mas", mainBasin: "Sungai Kelantan", subBasin: "Sg. Kelantan", level: 2.22, normal: 4.00, alert: 9.00, warning: 9.82, danger: 10.55 },
    { id: "0740111WL", name: "Empangan Bukit Kwong (F1)", district: "Pasir Mas", mainBasin: "Sungai Golok", subBasin: "Sg. Golok", level: 13.92, normal: 16.75, alert: 17.22, warning: 17.37, danger: 17.72 },
    { id: "0740121WL", name: "Sg. Golok di Rantau Panjang (F1)", district: "Pasir Mas", mainBasin: "Sungai Golok", subBasin: "Sg. Golok", level: 5.07, normal: 5.00, alert: 7.00, warning: 8.00, danger: 9.00 },
    { id: "0730581WL", name: "Sg. Kelantan di Jambatan Tendong (F2)", district: "Pasir Mas", mainBasin: "Sungai Kelantan", subBasin: "Sg. Kelantan", level: 1.50, normal: 3.00, alert: 4.00, warning: 5.00, danger: 6.00 },

    // === KOTA BHARU (3 stations) ===
    { id: "0730661WL", name: "Sg. Kelantan di Kg. Salor (F1)", district: "Kota Bharu", mainBasin: "Sungai Kelantan", subBasin: "Sg. Salor", level: 5.49, normal: 1.00, alert: 9.00, warning: 9.80, danger: 10.60 },
    { id: "0730671WL", name: "Sg. Kelantan di Tambatan D'Raja (F1)", district: "Kota Bharu", mainBasin: "Sungai Kelantan", subBasin: "Sg. Kelantan", level: 0.39, normal: 1.00, alert: 3.00, warning: 4.00, danger: 5.00 },
    { id: "0731301WL", name: "Sg. Kelantan di Kuala Besar (F1)", district: "Kota Bharu", mainBasin: "Sungai Kelantan", subBasin: "Sg. Kelantan", level: 0.61, normal: 1.30, alert: 1.50, warning: 1.70, danger: 1.85 },

    // === TUMPAT (1 station) ===
    { id: "0740241WL", name: "Sg. Golok di Kuala Jambu (F1)", district: "Tumpat", mainBasin: "Sungai Golok", subBasin: "Sg. Golok", level: 1.10, normal: 0.70, alert: 2.00, warning: 2.50, danger: 3.00 },

    // === BACHOK (1 station) ===
    { id: "0720101WL", name: "Sg. Melor di Jambatan Melor (F2)", district: "Bachok", mainBasin: "Sungai Kemasin", subBasin: "Sg. Melor", level: 5.43, normal: 6.00, alert: 7.00, warning: 8.00, danger: 9.00 },

    // === PASIR PUTEH (2 stations) ===
    { id: "0710121WL", name: "Sg. Buaya Ikat di Kg. Pulau Lima (F2)", district: "Pasir Puteh", mainBasin: "Sungai Semerak", subBasin: "Sg. Buaya Ikat", level: 0.65, normal: 1.00, alert: 2.00, warning: 3.00, danger: 4.00 },
    { id: "0710161WL", name: "Sg. Semerak di Tok Bali (F2)", district: "Pasir Puteh", mainBasin: "Sungai Semerak", subBasin: "Sg. Semerak", level: 1.35, normal: 0.00, alert: 2.50, warning: 3.00, danger: 4.00 },
];

/**
 * Get JPS station by ID
 */
export function getJpsStation(stationId: string): JpsStation | undefined {
    return JPS_KELANTAN_STATIONS.find(s => s.id === stationId);
}

/**
 * Tambatan D'Raja station — co-located with our Node A sensor
 */
export const TAMBATAN_DRAJA = JPS_KELANTAN_STATIONS.find(s => s.id === '0730671WL')!;
