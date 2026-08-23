/**
 * Official Aid Programs API
 * 
 * Serves verified dataset of Malaysian social welfare, cash transfer, and zakat programs
 * with eligibility criteria, official portals, and location-aware recommendations.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const langParam = searchParams.get('lang') || 'ms';

    let locationName = 'Malaysia';
    try {
        if (lat && lng) {
            const geoRes = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
                { headers: { 'User-Agent': 'NADI-Civic-OS/1.0' }, signal: AbortSignal.timeout(3000) }
            );
            const geoData = await geoRes.json();
            const addr = geoData.address || {};
            locationName = addr.state || addr.county || addr.city || addr.town || 'Malaysia';
        }
    } catch {
        locationName = 'Malaysia';
    }

    const isKelantan = locationName.toLowerCase().includes('kelantan');
    const isSelangor = locationName.toLowerCase().includes('selangor');

    // Verified Malaysian Social Welfare & Assistance Programs
    const verifiedPrograms = [
        // Federal Cash Assistance & Food Subsidies (STR, SARA, eKasih)
        {
            id: 'str_2026',
            name: 'Sumbangan Tunai Rahmah (STR)',
            provider: 'Kementerian Kewangan & LHDNM',
            type: 'government',
            description: 'Bantuan tunai langsung LHDNM untuk isi rumah (RM500–RM2,500/thn), warga emas (RM600/thn) & bujang (RM600/thn).',
            eligibility: '• Warganegara Malaysia menetap di Malaysia\n• Kategori Isi Rumah: Pendapatan ≤ RM5,000 sebulan\n• Kategori Warga Emas Tiada Pasangan: Umur 60+ tahun, Pendapatan ≤ RM5,000 sebulan\n• Kategori Bujang: Umur 21-59 tahun (atau OKU 19-59 tahun), Pendapatan ≤ RM2,500 sebulan',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://bantuantunai.hasil.gov.my/'
        },
        {
            id: 'sara_2026',
            name: 'Sumbangan Asas Rahmah (SARA)',
            provider: 'Kementerian Kewangan & Yayasan MyKasih',
            type: 'government',
            description: 'Bantuan tanpa tunai RM100/bulan melalui cip MyKad (RM1,200/thn untuk Miskin Tegar eKasih, RM600/thn untuk B40 STR) di 13,000+ peruncit.',
            eligibility: '• Penerima STR 2026 yang tersenarai dalam pangkalan data eKasih (Miskin Tegar: RM1,200/tahun)\n• Penerima Isi Rumah STR 2026 kategori B40 (RM600/tahun)\n• Bantuan dikreditkan secara automatik ke dalam cip MyKad untuk pembelian barang keperluan di 13,000+ kedai berdaftar',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://www.mykasih.com.my'
        },
        {
            id: 'mykasih_ngo',
            name: 'Yayasan MyKasih — Love My Neighbourhood & School',
            provider: 'Yayasan MyKasih (DIALOG Group)',
            type: 'ngo',
            description: 'Bantuan makanan tanpa tunai cip MyKad & dermasiswa pembelajaran komuniti Orang Asli & B40 (Talian Rasmi: 03-7720 1800).',
            eligibility: '• Keluarga B40 berpendapatan rendah & Miskin Tegar (eKasih)\n• Komuniti Orang Asli & murid sekolah awam berkeperluan khas\n• Dikreditkan terus ke cip MyKad untuk barangan makanan asas, yuran & peralatan sekolah',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://www.mykasih.com.my'
        },
        {
            id: 'ekasih_2026',
            name: 'eKasih',
            provider: 'Unit Penyelarasan Pelaksanaan (ICU JPM)',
            type: 'government',
            description: 'Portal induk pendaftaran kemiskinan persekutuan untuk bantuan rumah, elektrik & kebajikan per kapita DOSM 2024.',
            eligibility: '• Ketua Isi Rumah (KIR) Warganegara Malaysia\n• Pendapatan Isi Rumah / Per Kapita di bawah Garis Kemiskinan PGK DOSM 2024 (Miskin Tegar ≤ RM1,169 per kapita / ≤ RM2,208 isi rumah; Miskin ≤ RM5,250 isi rumah)\n• Pendaftaran boleh dibuat di Pejabat Daerah / Portal ICU JPM',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://ekasih2.icu.gov.my/#menu2'
        },

        // --- 2. JABATAN KEBAJIKAN MASYARAKAT (JKM 11 SKIM RASMI) ---
        {
            id: 'jkm_bwe',
            name: 'JKM — Bantuan Warga Emas (BWE)',
            provider: 'Jabatan Kebajikan Masyarakat (KPWKM)',
            type: 'government',
            description: 'Bantuan kewangan bulanan RM600 sebulan seorang untuk warga emas 60 tahun ke atas.',
            eligibility: '• Warganegara Malaysia berumur 60 tahun dan ke atas\n• Pendapatan Isi Rumah di bawah Garis Kemiskinan (PGK) Miskin Tegar Sebulan\n• Tidak tinggal di institusi jagaan JKM atau pusat jagaan berbayar\n• Tiada punca pendapatan sara hidup yang mencukupi',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://ebantuanjkm.jkm.gov.my'
        },
        {
            id: 'jkm_bkk',
            name: 'JKM — Bantuan Kanak-Kanak (BKK)',
            provider: 'Jabatan Kebajikan Masyarakat (KPWKM)',
            type: 'government',
            description: 'Bantuan kewangan RM200 – RM1,000/bulan (RM250/anak ≤6thn, RM200/anak 7-17thn).',
            eligibility: '• Penjaga warganegara Malaysia memelihara anak di bawah umur 18 tahun\n• Pendapatan Isi Rumah di bawah Garis Kemiskinan PGK Miskin Tegar\n• Kadar bantuan: RM250/bulan seorang (anak umur ≤ 6 tahun); RM200/bulan seorang (anak umur 7-17 tahun)\n• Maksimum RM1,000 sebulan bagi satu keluarga',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://ebantuanjkm.jkm.gov.my'
        },
        {
            id: 'jkm_epoku',
            name: 'JKM — Elaun Pekerja OKU (EPOKU)',
            provider: 'Jabatan Kebajikan Masyarakat (KPWKM)',
            type: 'government',
            description: 'Insentif kewangan bulanan RM450 sebulan seorang untuk OKU yang bekerja.',
            eligibility: '• Pemegang Kad OKU JKM berumur 16 tahun ke atas\n• Bekerja sendiri atau bermajikan dengan pendapatan bulanan antara RM100.00 hingga RM1,700.00 sebulan\n• Bukan penuntut sekolah / IPT sepenuh masa\n• Menetap di Malaysia',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://ebantuanjkm.jkm.gov.my'
        },
        {
            id: 'jkm_bpt',
            name: 'JKM — Bantuan Penjagaan OKU / Pesakit Kronik (BPT)',
            provider: 'Jabatan Kebajikan Masyarakat (KPWKM)',
            type: 'government',
            description: 'Bantuan kewangan bulanan RM500 sebulan seorang pesakit/OKU terlantar.',
            eligibility: '• Penjaga rapi yang memberikan jagaan harian sepenuhnya kepada OKU terlantar atau pesakit kronik terlantar\n• Pendapatan Isi Rumah tidak melebihi RM5,000.00 sebulan\n• Pesakit/OKU memerlukan bantuan penuh orang lain bagi aktiviti kehidupan harian (ADL)',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://ebantuanjkm.jkm.gov.my'
        },
        {
            id: 'jkm_btb',
            name: 'JKM — Bantuan OKU Tidak Berupaya Kerja (BTB)',
            provider: 'Jabatan Kebajikan Masyarakat (KPWKM)',
            type: 'government',
            description: 'Bantuan kewangan bulanan RM300 sebulan seorang untuk OKU tidak berupaya bekerja.',
            eligibility: '• Pemegang Kad OKU JKM berumur 16 hingga 59 tahun\n• Disahkan oleh Pegawai Perubatan Kerajaan tidak berupaya untuk bekerja\n• Pendapatan isi rumah di bawah PGK Miskin Tegar\n• Tidak menerima Elaun Pekerja OKU (EPOKU)',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://ebantuanjkm.jkm.gov.my'
        },
        {
            id: 'jkm_gp',
            name: 'JKM — Geran Pelancaran Perniagaan (GP)',
            provider: 'Jabatan Kebajikan Masyarakat (KPWKM)',
            type: 'government',
            description: 'Bantuan modal perniagaan RM2,700 secara sekali bayar (one-off) untuk pemerkasaan ekonomi kumpulan sasar berpotensi.',
            eligibility: '• Warganegara Malaysia kumpulan sasar JKM (Penerima Bantuan JKM / Bekas Pelatih Institusi / Asnaf)\n• Pendapatan isi rumah di bawah Garis Kemiskinan PGK\n• Berpotensi & berminat menjalankan usaha niaga/perkhidmatan sendiri\n• Modal RM2,700 sekali bayar untuk peralatan perniagaan',
            status: 'active',
            deadline: 'Permohonan Terbuka',
            location: 'Seluruh Negara',
            url: 'https://ebantuanjkm.jkm.gov.my'
        },
        {
            id: 'jkm_bats',
            name: 'JKM — Bantuan Alat Tiruan / Sokongan (BAT/S)',
            provider: 'Jabatan Kebajikan Masyarakat (KPWKM)',
            type: 'government',
            description: 'Bantuan pembelian/baik pulih alat sokongan (kerusi roda, anggota palsu, alat pendengaran dll).',
            eligibility: '• Warganegara Malaysia kumpulan sasar JKM\n• Disyorkan oleh Pegawai Perubatan / Pakar Perubatan Kerajaan\n• Pendapatan isi rumah di bawah PGK Kemiskinan\n• Meliputi kerusi roda, anggota palsu, alat pendengaran, kaki/tangan tiruan dll.',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://ebantuanjkm.jkm.gov.my'
        },
        {
            id: 'jkm_tbs',
            name: 'JKM — Tabung Bantuan Segera (TBS)',
            provider: 'Jabatan Kebajikan Masyarakat (KPWKM)',
            type: 'government',
            description: 'Bantuan wang tunai/makanan serta-merta sehingga RM300 untuk kes terdampar, kecemasan & bencana kecil.',
            eligibility: '• Warganegara Malaysia / kes terdampar di dalam negara\n• Mangsa kecemasan serta-merta, terputus bekalan makanan, atau mangsa bencana kecil/terpencil\n• Bantuan wang tunai / barangan makanan sehingga RM300 disalurkan serta-merta',
            status: 'active',
            deadline: 'Kecemasan Serta-Merta',
            location: 'Seluruh Negara',
            url: 'https://ebantuanjkm.jkm.gov.my'
        },

        // --- 3. MAIK (MAJLIS AGAMA ISLAM KELANTAN TAJAAN & BANTUAN RUMAH) ---
        {
            id: 'maik_dsip',
            name: 'MAIK — Dermasiswa Sultan Ismail Petra (DSIP)',
            provider: 'Majlis Agama Islam dan Adat Istiadat Melayu Kelantan',
            type: 'zakat',
            description: 'Dermasiswa pengajian RM2,500 (Diploma/Ijazah Dalam Negara) & RM5,000 – RM10,000 (Pengajian Luar Negara / Timur Tengah).',
            eligibility: '• Peranakan Kelantan (bapa lahir di Kelantan) bermastautin di Kelantan\n• Beragama Islam & tergolong dalam Asnaf Had Kifayah MAIK\n• Mengikuti pengajian Diploma / Ijazah Pertama sepenuh masa di IPTA/IPTS\n• Kadar: RM2,500 (Dalam Negara) | RM5,000 - RM10,000 (Luar Negara / Timur Tengah)',
            status: 'active',
            deadline: 'Permohonan Tahunan (Januari)',
            location: 'Kelantan / Luar Negara',
            url: 'https://eagihan.e-maik.my'
        },
        {
            id: 'maik_bpln_uk',
            name: 'MAIK — Biasiswa Pendidikan Luar Negara (BPLN United Kingdom)',
            provider: 'Majlis Agama Islam dan Adat Istiadat Melayu Kelantan',
            type: 'zakat',
            description: 'Tajaan biasiswa penuh lepasan SPM asnaf Kelantan bagi A-Level di Kolej UEM ke Ijazah Pertama di United Kingdom (UK).',
            eligibility: '• Peranakan Kelantan bermastautin di Kelantan\n• Keputusan SPM cemerlang (minima 8A/9A)\n• Tergolong dalam Asnaf mengikut Had Kifayah MAIK\n• Meliputi pengajian A-Level di Kolej UEM hingga Ijazah Pertama di Universiti Terkemuka United Kingdom (UK)',
            status: 'active',
            deadline: 'Permohonan Tahunan (April)',
            location: 'Kelantan / United Kingdom',
            url: 'https://eagihan.e-maik.my'
        },
        {
            id: 'maik_bsip',
            name: 'MAIK — Biasiswa Sultan Ismail Petra (BSIP Pengajian Islam Luar Negara)',
            provider: 'Majlis Agama Islam dan Adat Istiadat Melayu Kelantan',
            type: 'zakat',
            description: 'Biasiswa tajaan Ijazah Pertama Pengajian Islam Luar Negara (Mesir & Indonesia) lepasan MTQ MAIK & STAM.',
            eligibility: '• Peranakan Kelantan bermastautin di Kelantan\n• Lepasan MTQ MAIK / STAM YIK/JPNK yang mendapat tawaran universiti diiktiraf MQA (Al-Azhar Mesir / Indonesia)\n• Beragama Islam & Asnaf berkelayakan Had Kifayah MAIK',
            status: 'active',
            deadline: 'Permohonan Tahunan (Jun)',
            location: 'Kelantan / Mesir & Indonesia',
            url: 'https://eagihan.e-maik.my'
        },
        {
            id: 'maik_bpdn',
            name: 'MAIK — Biasiswa Pendidikan Dalam Negara (BPDN)',
            provider: 'Majlis Agama Islam dan Adat Istiadat Melayu Kelantan',
            type: 'zakat',
            description: 'Tajaan biasiswa penuh pengajian tinggi dalam negara untuk pelajar Asnaf Kelantan yang mendapat tempat di IPTA/IPTS.',
            eligibility: '• Peranakan Kelantan bermastautin di Kelantan\n• Mengikuti pengajian sepenuh masa Diploma / Ijazah Pertama di IPTA/IPTS berdaftar MQA\n• Tergolong dalam Asnaf Fakir/Miskin Had Kifayah MAIK\n• Tiada pembiayaan biasiswa daripada penaja badan lain',
            status: 'active',
            deadline: 'Permohonan Tahunan (April)',
            location: 'Kelantan',
            url: 'https://eagihan.e-maik.my'
        },
        {
            id: 'maik_bta',
            name: 'MAIK — Biasiswa Tengku Anis (BTA sekolah)',
            provider: 'Majlis Agama Islam dan Adat Istiadat Melayu Kelantan',
            type: 'zakat',
            description: 'Biasiswa bulanan sekolah rendah (RM100/bln), sekolah menengah T1-T5 (RM150/bln) & Tingkatan 6 (RM200/bln).',
            eligibility: '• Anak Kelantan yang bersekolah di Sekolah Kerajaan (JPNK) atau Sekolah Agama (YIK)\n• Kadar: Sekolah Rendah (RM100/bln), Sekolah Menengah T1-T5 (RM150/bln), Tingkatan 6 (RM200/bln)\n• Keutamaan Anak Yatim, Suri Rumah/Ibu Tunggal & Asnaf Fakir Miskin',
            status: 'active',
            deadline: 'Permohonan Tahunan (April)',
            location: 'Kelantan',
            url: 'https://eagihan.e-maik.my'
        },
        {
            id: 'maik_bpp_acca',
            name: 'MAIK — Biasiswa Profesional Perakaunan (BPP ACCA)',
            provider: 'Majlis Agama Islam dan Adat Istiadat Melayu Kelantan',
            type: 'zakat',
            description: 'Tajaan biasiswa ikhtisas perakaunan ACCA (1–4 tahun) untuk anak Kelantan asnaf.',
            eligibility: '• Peranakan Kelantan bermastautin di Kelantan\n• Keputusan akademik cemerlang dalam perakaunan (SPM/Diploma/Ijazah)\n• Mengikuti pengajian ikhtisas ACCA sepenuh masa (Tajaan 1 hingga 4 tahun)\n• Tergolong dalam Asnaf Had Kifayah MAIK',
            status: 'active',
            deadline: 'Permohonan Tahunan (April)',
            location: 'Kelantan',
            url: 'https://eagihan.e-maik.my'
        },
        {
            id: 'maik_rumah_bina',
            name: 'MAIK — Bantuan Bina Rumah Kediaman Asnaf',
            provider: 'Majlis Agama Islam dan Adat Istiadat Melayu Kelantan',
            type: 'zakat',
            description: 'Pembinaan rumah baharu percuma untuk keluarga Asnaf Kelantan yang mempunyai tapak tanah sendiri/ibu bapa.',
            eligibility: '• Anak Negeri Kelantan tergolong dalam Asnaf Fakir / Miskin MAIK\n• Mempunyai tanah sendiri atau mendapat kebenaran surat akuan bersumpah atas tanah ibu bapa\n• Rumah sedia ada daif / usang / tidak selamat didiami\n• Permohonan melalui Imam Masjid Bandar / Jajahan',
            status: 'active',
            deadline: 'Berterusan (Masjid Bandar)',
            location: 'Kelantan',
            url: 'https://eagihan.e-maik.my'
        },
        {
            id: 'maik_rumah_baikpulih',
            name: 'MAIK — Bantuan Pemulihan / Baik Pulih Rumah Kediaman',
            provider: 'Majlis Agama Islam dan Adat Istiadat Melayu Kelantan',
            type: 'zakat',
            description: 'Pembaikan kerosakan rumah kediaman milik sendiri/ibu bapa asnaf yang didiami dikendalikan kontraktor MAIK.',
            eligibility: '• Anak Negeri Kelantan tergolong dalam Asnaf Fakir / Miskin MAIK\n• Rumah sedia ada mendiami milik sendiri / ibu bapa yang mengalami kerosakan struktur fizikal\n• Pendapatan isi rumah di bawah Had Kifayah MAIK',
            status: 'active',
            deadline: 'Berterusan (Masjid Bandar / Online)',
            location: 'Kelantan',
            url: 'https://eagihan.e-maik.my'
        },

        // --- 4. BANTUAN AWAL PERSEKOLAHAN (BAP KPM) ---
        {
            id: 'bap_kpm_2026',
            name: 'Bantuan Awal Persekolahan (BAP KPM)',
            provider: 'Kementerian Pendidikan Malaysia (KPM)',
            type: 'government',
            description: 'Bantuan tunai khusus RM150 secara sekali bayar (one-off) untuk meringankan beban perbelanjaan persekolahan.',
            eligibility: '• Murid warganegara Malaysia berada di Tahun 1 hingga Tingkatan 5 (atau setaraf)\n• Bersekolah di Sekolah Kerajaan (SK), Sek Bantuan Kerajaan (SBK), Sek Agama, Swasta berdaftar KPM, Kolej PERMATA, Sekolah Bimbingan Jalinan Kasih, Sek Integriti, Sek Henry Gurney, MRSM & MTD\n• Bantuan RM150/murid secara sekali bayar (one-off) tanpa had pendapatan isi rumah',
            status: 'active',
            deadline: 'Disalurkan Awal Tahun',
            location: 'Seluruh Negara',
            url: 'https://www.moe.gov.my'
        },

        // --- 5. MYSTEP, PTPTN & KWSP ---
        {
            id: 'mystep_2026',
            name: 'Program MySTEP (Malaysia Short-Term Employment Programme)',
            provider: 'Kementerian Kewangan & JPA',
            type: 'government',
            description: 'Penempatan kerja kontrak sektor awam & GLC: Ijazah (RM2,000/bln), STPM/Diploma (RM1,800/bln), SPM (RM1,600/bln) + Cuti Rehat 12 hari & KWSP/PERKESO.',
            eligibility: '• Warganegara Malaysia berumur 18 tahun ke atas\n• Kadar Gaji: Ijazah (RM2,000/bln), STPM/Diploma (RM1,800/bln), SPM (RM1,600/bln), Tiada SPM (RM1,400/bln)\n• Kemudahan: Cuti Rehat 12 hari/tahun, Cuti Sakit 14 hari/tahun, caruman KWSP & PERKESO\n• Diwajibkan kuota khas 1% penempatan bagi golongan OKU',
            status: 'active',
            deadline: 'Permohonan Terbuka',
            location: 'Seluruh Negara',
            url: 'https://www.malaysia.gov.my/my/topics/program-mystep'
        },
        {
            id: isSelangor ? 'zakat_lzs' : 'zakat_maiwp',
            name: isSelangor ? 'Lembaga Zakat Selangor (LZS)' : 'Zakat MAIWP (Wilayah Persekutuan)',
            provider: isSelangor ? 'Lembaga Zakat Selangor' : 'Majlis Agama Islam Wilayah Persekutuan',
            type: 'zakat',
            description: 'Bantuan kewangan bulanan Asnaf, modal perniagaan, kecemasan perubatan & sewaan rumah.',
            eligibility: '• Umat Islam Warganegara Malaysia bermastautin di Selangor sekurang-kurangnya 3 tahun\n• Pendapatan isi rumah di bawah Had Kifayah LZS Selangor\n• Kategori Asnaf: Fakir, Miskin, Muallaf, Gharimin, Ibnus Sabil & Fisabilillah',
            status: 'active',
            deadline: 'Berterusan',
            location: isSelangor ? 'Selangor' : 'Wilayah Persekutuan',
            url: isSelangor ? 'https://www.zakatselangor.com.my/permohonan-bantuan/' : 'https://www.maiwp.gov.my'
        },
        {
            id: 'ptptn_2026',
            name: 'Pinjaman & Biasiswa PTPTN',
            provider: 'Perbadanan Tabung Pendidikan Tinggi Nasional',
            type: 'government',
            description: 'Pembiayaan pendidikan pengajian tinggi awam/swasta serta insentif pengecualian bayaran untuk Ijazah Pertama Kelas Pertama.',
            eligibility: '• Warganegara Malaysia berumur tidak melebihi 45 tahun pada tarikh permohonan\n• Mendapat tawaran kemasukan ke IPTA / IPTS / Politeknik berdaftar MQA\n• Pengecualian bayaran balik (Biasiswa Penuh) untuk graduan Ijazah Pertama Kelas Pertama',
            status: 'active',
            deadline: '31 Disember 2026',
            location: 'Seluruh Negara',
            url: 'https://www.ptptn.gov.my'
        },
        {
            id: 'isaraan_2026',
            name: 'i-Saraan KWSP (Caruman Bertambah)',
            provider: 'Kumpulan Wang Simpanan Pekerja (KWSP)',
            type: 'government',
            description: 'Insentif caruman padanan kerajaan sehingga 15% (maksimum RM500/tahun) untuk pekerja sektor tidak formal / Gig.',
            eligibility: '• Warganegara Malaysia berumur di bawah 60 tahun\n• Pekerja sektor tidak formal (Peniaga kecil, Petani, Nelayan, Pemandu e-Hailing, Freelancer & Suri Rumah)\n• Menerima insentif caruman padanan 15% daripada kerajaan (Sehingga maksimum RM500/tahun)',
            status: 'active',
            deadline: 'Berterusan',
            location: 'Seluruh Negara',
            url: 'https://www.kwsp.gov.my/ms/ahli/caruman/i-saraan'
        }
    ];

    return NextResponse.json({
        success: true,
        programs: verifiedPrograms,
        location: locationName,
        total: verifiedPrograms.length,
    }, {
        headers: {
            'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        },
    });
}
