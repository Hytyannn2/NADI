export interface RankCardData {
  userName: string;
  userEmail?: string;
  mukimName?: string;
  level: number;
  rank: string;
  xp: number;
  xpToNext: number;
  completedQuests: number;
  badgesCount: number;
}

export function generateRankCard(data: RankCardData) {
  const cardId = `CRS-RANK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // PII Protection: Mask email and strictly use display name / mukim area
  const displayName = data.userName || 'Warga Prihatin NADI';
  const mukimText = data.mukimName ? `Mukim ${data.mukimName}` : 'Kelantan Civics Node';

  const htmlContent = `
<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <title>SIJIL KAD CRS NADI - ${displayName}</title>
    <style>
        @page { size: A5 landscape; margin: 0; }
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            background: #050507;
            color: #ffffff;
            margin: 0;
            padding: 30px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            min-h: 100vh;
        }
        .card {
            width: 100%;
            max-width: 580px;
            background: linear-gradient(135deg, #0F0F13 0%, #050507 100%);
            border: 2px solid #C5A367;
            border-radius: 24px;
            padding: 28px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(197, 163, 103, 0.15);
            position: relative;
            overflow: hidden;
        }
        .glow {
            position: absolute;
            top: -50px;
            right: -50px;
            width: 180px;
            height: 180px;
            background: rgba(197, 163, 103, 0.2);
            filter: blur(50px);
            border-radius: 50%;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 14px;
            margin-bottom: 20px;
        }
        .logo {
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -1px;
            color: #ffffff;
        }
        .logo span { color: #C5A367; }
        .badge {
            background: rgba(197, 163, 103, 0.15);
            border: 1px solid rgba(197, 163, 103, 0.3);
            color: #C5A367;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .user-info {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 20px;
        }
        .avatar {
            width: 64px;
            height: 64px;
            border-radius: 20px;
            background: linear-gradient(135deg, #C5A367 0%, #3B82F6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            color: #ffffff;
            border: 2px solid #C5A367;
        }
        .user-details h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 800;
            color: #ffffff;
        }
        .user-details p {
            margin: 2px 0 0 0;
            font-size: 12px;
            color: #9CA3AF;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }
        .stat-tile {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px;
            padding: 12px;
            text-align: center;
        }
        .stat-label {
            font-size: 9px;
            font-weight: 700;
            color: #9CA3AF;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .stat-value {
            font-size: 18px;
            font-weight: 900;
            color: #ffffff;
            font-family: monospace;
        }
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            color: #6B7280;
            border-top: 1px solid rgba(255,255,255,0.08);
            padding-top: 12px;
        }
        @media print {
            body { background: none; padding: 0; }
            .card { border-color: #000; box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="glow"></div>
        
        <div class="header">
            <div class="logo">NADI <span>CRS</span></div>
            <div class="badge">Sijil Kepercayaan Awam</div>
        </div>

        <div class="user-info">
            <div class="avatar">${displayName.charAt(0).toUpperCase()}</div>
            <div class="user-details">
                <h2>${displayName}</h2>
                <p>Tahap ${data.level} • Rank: <strong style="color: #C5A367;">${data.rank}</strong> • ${mukimText}</p>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-tile">
                <div class="stat-label">Mata XP</div>
                <div class="stat-value" style="color: #C5A367;">${data.xp}</div>
            </div>
            <div class="stat-tile">
                <div class="stat-label">Misi Selesai</div>
                <div class="stat-value" style="color: #10B981;">${data.completedQuests}</div>
            </div>
            <div class="stat-tile">
                <div class="stat-label">Lencana CRS</div>
                <div class="stat-value" style="color: #3B82F6;">${data.badgesCount}</div>
            </div>
        </div>

        <div class="footer">
            <span>Sistem Pangkat & Kepercayaan Warga NADI Malaysia</span>
            <span style="font-family: monospace;">ID: ${cardId}</span>
        </div>
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
