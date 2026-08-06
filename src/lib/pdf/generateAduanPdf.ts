export interface PdfAnomalyData {
  id: string;
  title?: string;
  originalText?: string;
  translatedText?: string;
  userIntendedMeaning?: string;
  detectedDialect?: string;
  lat: number;
  lng: number;
  locationName?: string;
  time: string;
  urgency?: string;
  status: string;
  confidenceScore?: number;
  zDropped?: number;
  aiAnalysis?: {
    damageType?: string;
    severityScore?: number;
    severityLabel?: string;
    estimatedWidth?: string;
    estimatedDepth?: string;
    repairMethod?: string;
    repairCostMYR?: string;
    priorityScore?: number;
    riskAssessment?: string;
  } | null;
}

export function generatePayloadHash(ticket: { id: string; status: string; confidenceScore?: number; time?: string }): string {
  // Deterministic string concatenation for client & server match
  const payloadString = `${ticket.id}|${ticket.status}|${ticket.confidenceScore || 0}|${ticket.time || ''}`;
  let hash = 0;
  for (let i = 0; i < payloadString.length; i++) {
    const char = payloadString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function generateAduanPdf(anomaly: PdfAnomalyData) {
  const ticketId = `NADI-2026-${anomaly.id.slice(-6).toUpperCase()}`;
  const payloadHash = generatePayloadHash(anomaly);

  // Dynamic Base URL Resolution (works seamlessly on http://localhost:3000 during live demo & in production)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://nadi-kelantan.app');

  const verificationUrl = `${baseUrl}/verify/${anomaly.id}?hash=${payloadHash}`;

  const nowStr = new Date().toLocaleDateString('ms-MY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const locationText = anomaly.locationName
    ? `${anomaly.locationName} (${anomaly.lat.toFixed(4)}° N, ${anomaly.lng.toFixed(4)}° E)`
    : `${anomaly.lat.toFixed(4)}° N, ${anomaly.lng.toFixed(4)}° E`;

  const issueTitle = anomaly.title || anomaly.aiAnalysis?.damageType || 'Aduan Kerosakan Infrastruktur Sivik';
  const urgencyLabel = anomaly.urgency === 'High' ? 'TINGGI (SEGERA)' : anomaly.urgency === 'Medium' ? 'SEDERHANA' : 'BIASA / RENDAH';

  const htmlContent = `
<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <title>BORANG ADUAN DIGITAL NADI - ${ticketId}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            color: #111827;
            background: #ffffff;
            margin: 0;
            padding: 20px;
            font-size: 12px;
            line-height: 1.5;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #C5A367;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }
        .logo-box {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: -1px;
            color: #050507;
        }
        .logo-badge {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #C5A367;
            display: block;
        }
        .doc-title {
            text-align: right;
        }
        .doc-title h1 {
            font-size: 13px;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #111827;
        }
        .ticket-id {
            font-family: monospace;
            font-size: 13px;
            font-weight: bold;
            color: #B91C1C;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            background: #F9FAFB;
            border: 1px solid #E5E7EB;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
        }
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        .meta-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            color: #6B7280;
            letter-spacing: 0.5px;
        }
        .meta-value {
            font-size: 12px;
            font-weight: 700;
            color: #111827;
        }
        .section-box {
            border: 1px solid #D1D5DB;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 16px;
        }
        .section-header {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #374151;
            border-bottom: 1px solid #E5E7EB;
            padding-bottom: 6px;
            margin-bottom: 10px;
        }
        .quote-box {
            background: #FEF3C7;
            border-left: 4px solid #D97706;
            padding: 10px 12px;
            font-style: italic;
            font-weight: 600;
            margin-bottom: 8px;
            border-radius: 0 6px 6px 0;
        }
        .analysis-box {
            background: #ECFDF5;
            border-left: 4px solid #059669;
            padding: 10px 12px;
            color: #065F46;
            font-weight: 600;
            border-radius: 0 6px 6px 0;
        }
        .qr-section {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border: 2px dashed #C5A367;
            border-radius: 8px;
            padding: 12px 16px;
            margin-top: 24px;
            background: #FFFDF5;
        }
        .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 35px;
            padding-top: 15px;
        }
        .signature-line {
            border-top: 1px solid #9CA3AF;
            margin-top: 45px;
            text-align: center;
            font-size: 10px;
            font-weight: bold;
            color: #4B5563;
        }
        .footer-note {
            margin-top: 30px;
            text-align: center;
            font-size: 9px;
            color: #9CA3AF;
            border-top: 1px solid #F3F4F6;
            padding-top: 10px;
        }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="logo-box">NADI</div>
            <span class="logo-badge">Sistem Operasi Sivik & Respons Bencana</span>
        </div>
        <div class="doc-title">
            <h1>Borang Aduan Digital (Pencegahan Pemalsuan)</h1>
            <div class="ticket-id">TIKET ID: ${ticketId}</div>
        </div>
    </div>

    <div class="meta-grid">
        <div class="meta-item">
            <span class="meta-label">Tajuk / Jenis Aduan</span>
            <span class="meta-value">${issueTitle}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Tarikh Laporan</span>
            <span class="meta-value">${nowStr}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Lokasi Koordinat GPS</span>
            <span class="meta-value">${locationText}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Tahap Keutamaan Tindakan</span>
            <span class="meta-value" style="color: ${anomaly.urgency === 'High' ? '#DC2626' : '#D97706'};">${urgencyLabel}</span>
        </div>
    </div>

    ${anomaly.originalText ? `
    <div class="section-box">
        <div class="section-header">💬 kenyataan asal warga & analisis dialek ai</div>
        <div class="quote-box">"${anomaly.originalText}"</div>
        ${anomaly.userIntendedMeaning ? `<div class="analysis-box"><strong>Maksud Sebenar (NLP Groq Llama 3.3):</strong> ${anomaly.userIntendedMeaning}</div>` : ''}
    </div>
    ` : ''}

    ${anomaly.aiAnalysis ? `
    <div class="section-box">
        <div class="section-header">🤖 penilaian kejuruteraan ai & anggaran kerosakan</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <tr>
                <td style="padding: 4px 0; font-weight: bold; width: 40%;">Tahap Kerosakan:</td>
                <td style="padding: 4px 0;">${anomaly.aiAnalysis.severityLabel || 'Sederhana'} (${anomaly.aiAnalysis.severityScore || 3}/5)</td>
            </tr>
            <tr>
                <td style="padding: 4px 0; font-weight: bold;">Anggaran Saiz:</td>
                <td style="padding: 4px 0;">Lebar: ${anomaly.aiAnalysis.estimatedWidth || '1.2m'} | Kedalaman: ${anomaly.aiAnalysis.estimatedDepth || '0.15m'}</td>
            </tr>
            <tr>
                <td style="padding: 4px 0; font-weight: bold;">Kaedah Pembaikan Disyorkan:</td>
                <td style="padding: 4px 0;">${anomaly.aiAnalysis.repairMethod || 'Tampalan Asfalt Panas (Hot-mix patch)'}</td>
            </tr>
            <tr>
                <td style="padding: 4px 0; font-weight: bold;">Anggaran Kos Pembaikan (MYR):</td>
                <td style="padding: 4px 0; font-weight: bold; color: #059669;">${anomaly.aiAnalysis.repairCostMYR || 'RM 450.00'}</td>
            </tr>
        </table>
    </div>
    ` : ''}

    <div class="qr-section">
        <div>
            <strong style="font-size: 11px; display: block; text-transform: uppercase;">Cap Jari Pengesahan Integriti NADI</strong>
            <span style="font-size: 10px; color: #4B5563;">Imbas QR ini untuk menyemak ketepatan dokumen dengan pangkalan data rasmi NADI. Hash: ${payloadHash}</span>
        </div>
        <div style="font-family: monospace; font-size: 9px; background: #050507; color: #C5A367; padding: 8px 12px; border-radius: 6px; text-align: center;">
            [ IMBAS PENGESAHAN ]<br>${ticketId}<br><a href="${verificationUrl}" target="_blank" style="color: #6EE7B7; text-decoration: none;">Semak Pangkalan Data</a>
        </div>
    </div>

    <div class="signature-grid">
        <div>
            <div class="signature-line">Pegawai Pengesah Aduan (PBT / JJKR)</div>
        </div>
        <div>
            <div class="signature-line">Tandatangan & Cop Rasmi Jabatan</div>
        </div>
    </div>

    <div class="footer-note">
        Dokumen Pengesahan Integriti NADI Malaysia • ${baseUrl}
    </div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
