/**
 * OpenStreetMap Geocoder Script for Kelantan PPS Evacuation Centers
 * Batch fetches latitude and longitude coordinates for relief shelters in Kelantan.
 */

const fs = require('fs');
const path = require('path');

// Extracts raw PPS dataset from source file
const ppsDataPath = path.join(__dirname, '../src/data/kelantanPpsCenters.ts');
const fileContent = fs.readFileSync(ppsDataPath, 'utf8');

const startIndex = fileContent.indexOf('{', fileContent.indexOf('RAW_PPS_DATA'));
const endIndex = fileContent.indexOf('};', startIndex) + 1;

const objectStr = fileContent.substring(startIndex, endIndex);
const RAW_PPS_DATA = eval('(' + objectStr + ')');

const CACHE_FILE = path.join(__dirname, '../src/data/geocoded_cache.json');
let cache = {};

const shouldCleanAll = process.argv.includes('--clean') || process.env.FORCE_CLEAN === '1';

if (shouldCleanAll) {
    console.log("🧹 --clean flag detected. Wiping geocoded_cache.json and starting completely fresh!");
    cache = {};
    fs.writeFileSync(CACHE_FILE, JSON.stringify({}, null, 2));
} else if (fs.existsSync(CACHE_FILE)) {
    try {
        const rawCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        for (const [k, v] of Object.entries(rawCache)) {
            if (v && v.exact === true) {
                cache[k] = v;
            }
        }
        console.log(`🧹 Cache cleaned: Kept ${Object.keys(cache).length} verified exact matches, removed non-exact entries.`);
    } catch (e) {
        cache = {};
    }
}

// Jajahan center fallback coordinates
const JAJAHAN_CENTER_COORDS = {
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

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeQuery(query, retries = 2) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NADI-Disaster-System/2.0'
                }
            });
            if (response.status === 429) {
                console.warn(`  ⚠️ Rate limited (429), waiting 3s...`);
                await sleep(3000);
                continue;
            }
            if (!response.ok) return null;
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    displayName: data[0].display_name
                };
            }
            return null;
        } catch (e) {
            if (attempt < retries) {
                await sleep(2000);
            }
        }
    }
    return null;
}

function generateQueryVariations(rawName, jajahan) {
    const variations = [];
    const cleanName = rawName.replace(/[\(\)]/g, ' ').trim();
    
    // 1. Raw query
    variations.push(`${cleanName}, ${jajahan}, Kelantan, Malaysia`);

    // 2. Expand SK / SMK / S.K. / SEK. KEB. / SRJK
    let expanded = cleanName
        .replace(/SEK\.?\s*KEB\.?/gi, 'Sekolah Kebangsaan')
        .replace(/S\.K\.?/gi, 'Sekolah Kebangsaan')
        .replace(/Sek\s*Keb/gi, 'Sekolah Kebangsaan')
        .replace(/SEK\.?\s*MEN\.?\s*KEB\.?/gi, 'Sekolah Menengah Kebangsaan')
        .replace(/S\.M\.K\.?/gi, 'Sekolah Menengah Kebangsaan')
        .replace(/SEK\.?\s*MEN\.?/gi, 'Sekolah Menengah Kebangsaan')
        .replace(/SRJK\s*\(?C\)?/gi, 'SJK C')
        .replace(/SRJKC/gi, 'SJK C');

    if (expanded !== cleanName) {
        variations.push(`${expanded}, ${jajahan}, Kelantan, Malaysia`);
    }

    // 3. Compact SK / SMK query
    let compact = cleanName
        .replace(/Sekolah Kebangsaan/gi, 'SK')
        .replace(/Sekolah Menengah Kebangsaan/gi, 'SMK')
        .replace(/SEK\.?\s*KEB\.?/gi, 'SK')
        .replace(/S\.K\.?/gi, 'SK')
        .replace(/SEK\.?\s*MEN\.?\s*KEB\.?/gi, 'SMK')
        .replace(/S\.M\.K\.?/gi, 'SMK');

    if (compact !== cleanName && compact !== expanded) {
        variations.push(`${compact}, ${jajahan}, Kelantan`);
    }

    // 4. Strip prefix labels like "Dewan Orang Ramai", "Balai Raya", "Pusat Pemindahan", "Madrasah"
    let stripped = cleanName
        .replace(/Dewan Orang Ramai/gi, '')
        .replace(/Dewan Serbaguna/gi, '')
        .replace(/Dewan/gi, '')
        .replace(/Balai Raya/gi, '')
        .replace(/Balairaya/gi, '')
        .replace(/Pusat Pemindahan/gi, '')
        .replace(/Masjid Mukim/gi, 'Masjid')
        .replace(/Madrasah/gi, '')
        .replace(/Surau/gi, '')
        .trim();

    if (stripped.length > 3 && stripped !== cleanName) {
        variations.push(`${stripped}, ${jajahan}, Kelantan`);
    }

    return Array.from(new Set(variations));
}

async function main() {
    console.log("🚀 Starting NADI Multi-Pass Automated Geocoder for Kelantan Evacuation Centers...");
    
    let totalProcessed = 0;
    let totalExactSuccess = 0;
    const finalResults = {};

    for (const [jajahan, names] of Object.entries(RAW_PPS_DATA)) {
        finalResults[jajahan] = [];
        const fallback = JAJAHAN_CENTER_COORDS[jajahan] || { lat: 6.1254, lng: 102.2381 };

        console.log(`\n📍 Processing Jajahan ${jajahan} (${names.length} centers)...`);

        for (let idx = 0; idx < names.length; idx++) {
            const rawName = names[idx].trim();
            const cacheKey = `${jajahan}:${rawName}`;
            totalProcessed++;

            // Skip if already found with exact satellite match
            if (cache[cacheKey] && cache[cacheKey].exact) {
                finalResults[jajahan].push({
                    name: rawName,
                    ...cache[cacheKey]
                });
                totalExactSuccess++;
                continue;
            }

            const queryVariations = generateQueryVariations(rawName, jajahan);
            console.log(`[${totalProcessed}/${Object.keys(RAW_PPS_DATA).reduce((acc, k) => acc + RAW_PPS_DATA[k].length, 0)}] Geocoding: "${rawName}" (${jajahan})`);

            let res = null;
            for (const q of queryVariations) {
                res = await geocodeQuery(q);
                await sleep(1000); // Respect OpenStreetMap 1s rate limit
                if (res) break;
            }

            if (res) {
                console.log(`  ✅ Exact Match: ${res.lat}, ${res.lng} (${res.displayName})`);
                cache[cacheKey] = { lat: res.lat, lng: res.lng, exact: true };
                totalExactSuccess++;
            } else {
                // Deterministic Jajahan centroid offset fallback
                const angle = (idx * 137.5 * Math.PI) / 180;
                const radius = 0.004 + ((idx % 15) * 0.0018);
                const approxLat = Number((fallback.lat + Math.sin(angle) * radius).toFixed(6));
                const approxLng = Number((fallback.lng + Math.cos(angle) * radius).toFixed(6));
                
                cache[cacheKey] = { lat: approxLat, lng: approxLng, exact: false };
                console.log(`  ⚠️ Fallback centroid: ${approxLat}, ${approxLng}`);
            }

            finalResults[jajahan].push({
                name: rawName,
                ...cache[cacheKey]
            });

            // Save cache to disk
            fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        }
    }

    console.log(`\n======================================================`);
    console.log(`🎉 Geocoding Finished! Total Centers: ${totalProcessed}, Exact Satellite Matches: ${totalExactSuccess}`);
    console.log(`======================================================`);

    fs.writeFileSync(
        path.join(__dirname, '../src/data/geocodedKelantanPps.json'),
        JSON.stringify(finalResults, null, 2)
    );
}

main();
