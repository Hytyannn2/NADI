# ============================================
# Simulate TTN Webhook — No hardware needed!
# Run this while `npm run dev:next` is running
# ============================================

$baseUrl = "http://localhost:3000/api/bencana/sensors/webhook"

# --- Test 1: Health check (GET) ---
Write-Host "`n=== Test 1: Webhook Health Check ===" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri $baseUrl -Method GET
$health | ConvertTo-Json
Write-Host "✅ Webhook is alive" -ForegroundColor Green

# --- Test 2: Send a SAFE reading ---
Write-Host "`n=== Test 2: Safe Reading (25cm) ===" -ForegroundColor Cyan
$safePayload = @{
    end_device_ids = @{
        dev_eui = "0018B20000000001"
        device_id = "sungai-kelantan-node-a"
    }
    uplink_message = @{
        decoded_payload = @{
            water_level_cm = 25
            battery_pct = 92
            temperature_c = 29.5
            humidity_pct = 75
            pressure_hpa = 1013.2
            danger = $false
            rapid_rise = $false
            battery_low = $false
            sensor_fault = $false
        }
        rx_metadata = @(
            @{ rssi = -58; snr = 9.2 }
        )
    }
} | ConvertTo-Json -Depth 5

$result1 = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $safePayload -ContentType "application/json"
$result1 | ConvertTo-Json
Write-Host "✅ Safe reading sent" -ForegroundColor Green

Start-Sleep -Seconds 2

# --- Test 3: Send a WARNING reading (rising water) ---
Write-Host "`n=== Test 3: Warning Reading (85cm) ===" -ForegroundColor Yellow
$warnPayload = @{
    end_device_ids = @{
        dev_eui = "0018B20000000001"
        device_id = "sungai-kelantan-node-a"
    }
    uplink_message = @{
        decoded_payload = @{
            water_level_cm = 85
            battery_pct = 88
            temperature_c = 30.1
            humidity_pct = 82
            pressure_hpa = 1009.5
            danger = $false
            rapid_rise = $false
            battery_low = $false
            sensor_fault = $false
        }
        rx_metadata = @(
            @{ rssi = -62; snr = 8.0 }
        )
    }
} | ConvertTo-Json -Depth 5

$result2 = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $warnPayload -ContentType "application/json"
$result2 | ConvertTo-Json
Write-Host "⚠️ Warning reading sent" -ForegroundColor Yellow

Start-Sleep -Seconds 2

# --- Test 4: Send a DANGER reading with rapid rise ---
Write-Host "`n=== Test 4: Danger Reading (135cm, rapid rise!) ===" -ForegroundColor Red
$dangerPayload = @{
    end_device_ids = @{
        dev_eui = "0018B20000000001"
        device_id = "sungai-kelantan-node-a"
    }
    uplink_message = @{
        decoded_payload = @{
            water_level_cm = 135
            battery_pct = 85
            temperature_c = 28.7
            humidity_pct = 94
            pressure_hpa = 1005.1
            danger = $true
            rapid_rise = $true
            battery_low = $false
            sensor_fault = $false
        }
        rx_metadata = @(
            @{ rssi = -71; snr = 6.5 }
        )
    }
} | ConvertTo-Json -Depth 5

$result3 = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $dangerPayload -ContentType "application/json"
$result3 | ConvertTo-Json
if ($result3.telegram_sent) {
    Write-Host "DANGER reading sent + Telegram alert fired!" -ForegroundColor Red
} else {
    Write-Host "DANGER reading sent (Telegram not configured - see .env.local)" -ForegroundColor Yellow
}

# --- Test 5: Verify readings API ---
Write-Host "`n=== Test 5: Fetch Readings History ===" -ForegroundColor Cyan
$sensorId = $result3.sensor_id
if ($sensorId) {
    $readingsUrl = $baseUrl.Replace('/webhook', '/readings') + "?sensor_id=$sensorId" + "&hours=24"
    $readings = Invoke-RestMethod -Uri $readingsUrl
    Write-Host "Found $($readings.count) readings for sensor $sensorId" -ForegroundColor Green
    $readings.readings | ForEach-Object {
        Write-Host "   $($_.recorded_at) - $($_.water_level)cm, $($_.temperature_c)C, $($_.pressure_hpa)hPa"
    }
}
else {
    Write-Host "No sensor_id returned - check if migration was applied" -ForegroundColor Yellow
}

# --- Test 6: Telegram connectivity test ---
Write-Host "`n=== Test 6: Telegram Bot Test ===" -ForegroundColor Cyan
$telegramUrl = $baseUrl.Replace('/sensors/webhook', '/telegram/test')
try {
    $telegramResult = Invoke-RestMethod -Uri $telegramUrl -Method GET
    Write-Host "Telegram connected: $($telegramResult.message)" -ForegroundColor Green
} catch {
    Write-Host "Telegram not configured (optional - add TELEGRAM_BOT_TOKEN to .env.local)" -ForegroundColor Yellow
}

Write-Host "`n=== All tests complete! ===" -ForegroundColor Green
Write-Host "Open your browser to see the dashboard update in real-time." -ForegroundColor White
Write-Host "The Sensors tab should show all 3 readings in the trend chart." -ForegroundColor White

