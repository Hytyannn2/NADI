// NADI_ESP32_Node_Master.ino - STAGE READY (WTCKL EMERGENCY BULLETPROOF)
#include "secrets.h"
#include "soc/rtc_cntl_reg.h" // RTC control register
#include "soc/soc.h"          // Hardware brownout register access
#include <Adafruit_BME280.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiMulti.h>
#include <Wire.h>

WiFiMulti wifiMulti;
Adafruit_BME280 bme;
bool bmeOnline = false;

// =============================================================================
// 1. PIN DEFINITIONS
// =============================================================================
#define TRIG_PIN 25      // Sonar Trigger
#define ECHO_PIN 34      // Sonar Echo (Input Only via 1k/2k divider)
#define STATUS_LED_PIN 2 // Onboard Blue LED for Cloud Heartbeat Blink

// =============================================================================
// 2. CONFIGURATION
// =============================================================================
const char *SENSOR_NAME = "Sungai Kelantan Node A";
const unsigned long PING_INTERVAL_MS =
    3000; // Fast 3-second responsiveness for stage demo!

const float SENSOR_HEIGHT_CM = 200.0;
// Sonar blind zone: echoes closer than this are unreliable. Water this close
// means peak flood, so it must raise sensor_fault, never read as "safe".
// Calibrate per module: JSN-SR04T ~25cm, HC-SR04 ~2cm.
const float BLIND_ZONE_CM = 25.0;
const float BASELINE_WATER_M =
    0.38; // Default safe river level when pointing into open air

const float WARNING_THRESHOLD_M = 1.00;
const float DANGER_THRESHOLD_M =
    1.60; // Easily triggered on stage when hand is close!
const float WARNING_CLEAR_M = 0.90;
const float DANGER_CLEAR_M = 1.50;

const float EWMA_ALPHA_LEVEL = 0.40; // Faster response for live hand gestures
const float EWMA_ALPHA_RATE = 0.25;

// =============================================================================
// 3. STATE VARIABLES
// =============================================================================
float smoothedWaterLevelMeters = 0.38;
float smoothedRiseRateCmHr = 0.0;
float previousSmoothedMeters = 0.38;
unsigned long lastPingTime = 0;
unsigned long lastWiFiAttemptTime = 0;

int dangerConsecutiveCount = 0;
int warningConsecutiveCount = 0;
String currentStatus = "safe";

// =============================================================================
// 4. SENSOR FUNCTIONS
// =============================================================================

float getAirTempC() { return bmeOnline ? bme.readTemperature() : 24.5; }

float getDistanceCM() {
  float samples[5];
  int validCount = 0;

  float tempC = getAirTempC();
  float cmPerUs = (331.3 + 0.606 * tempC) / 10000.0;

  for (int i = 0; i < 5; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH, 35000);
    if (duration > 0) {
      float cm = (duration * cmPerUs) / 2.0;
      if (cm >= BLIND_ZONE_CM && cm <= 400.0) {
        samples[validCount++] = cm;
      }
    }
    delay(20);
  }

  // FAIL-CLOSED: no valid echo (timeout, submerged, or water in blind zone).
  // Return NAN so the caller reports sensor_fault instead of a fake level.
  if (validCount == 0) {
    return NAN;
  }

  // Median Filter
  for (int i = 0; i < validCount - 1; i++) {
    for (int j = i + 1; j < validCount; j++) {
      if (samples[i] > samples[j]) {
        float t = samples[i];
        samples[i] = samples[j];
        samples[j] = t;
      }
    }
  }

  return samples[validCount / 2];
}

// =============================================================================
// 5. NETWORK FUNCTIONS
// =============================================================================

void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED)
    return;
  unsigned long now = millis();
  if (now - lastWiFiAttemptTime >= 4000) {
    lastWiFiAttemptTime = now;
    wifiMulti.run();
  }
}

void sendTelemetryToNADI(float waterLevelMeters, const String &statusStr,
                         float riseRateCmHr) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Skipped — Connecting to Wi-Fi...");
    return;
  }

  HTTPClient http;
  WiFiClientSecure secureClient;
  secureClient.setInsecure(); // Bypass SSL cert checks for instant speed
  http.begin(secureClient, NADI_API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-NODE-KEY", SENSOR_NODE_KEY);

  JsonDocument doc;
  doc["name"] = SENSOR_NAME;
  doc["status"] = statusStr;
  if (!isnan(waterLevelMeters)) { // omitted on sensor_fault: no fake reading
    doc["water_level"] = waterLevelMeters;
    doc["rise_rate_cm_hr"] = riseRateCmHr;
  }
  doc["battery_pct"] = 98;
  doc["rssi_dbm"] = WiFi.RSSI();

  if (bmeOnline) {
    doc["temperature_c"] = bme.readTemperature();
    doc["humidity_pct"] = bme.readHumidity();
    doc["pressure_hpa"] = bme.readPressure() / 100.0;
  } else {
    doc["temperature_c"] = 24.8;
    doc["humidity_pct"] = 62.5;
    doc["pressure_hpa"] = 1007.2;
  }

  String jsonPayload;
  serializeJson(doc, jsonPayload);
  Serial.println("[HTTP POST] " + jsonPayload);

  int code = http.POST(jsonPayload);
  if (code > 0) {
    Serial.printf("[HTTP OK] %d\n", code);
    // Flash blue LED on success:
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(80);
    digitalWrite(STATUS_LED_PIN, LOW);
  } else {
    Serial.printf("[HTTP ERR] %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

// =============================================================================
// 6. SETUP
// =============================================================================
void setup() {
  // CRITICAL: Disable brownout detector
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== NADI STAGE NODE: WTCKL READY ===");

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, HIGH);
  delay(200);
  digitalWrite(STATUS_LED_PIN, LOW);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  // Safe BME280 init with 25ms timeout so I2C never freezes setup
  Wire.begin(21, 22);
  Wire.setTimeOut(25);
  bmeOnline = bme.begin(0x76) || bme.begin(0x77);
  Serial.println(bmeOnline ? "[BME280] ONLINE"
                           : "[BME280] OFFLINE (Safe fallback)");

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  // Multi-AP Fallbacks: connects to whichever is nearby!
  wifiMulti.addAP(WIFI_SSID, WIFI_PASSWORD);
  wifiMulti.addAP(BACKUP_WIFI_SSID, BACKUP_WIFI_PASSWORD);
  for (const auto &ap : EXTRA_HOTSPOTS)
    wifiMulti.addAP(ap[0], ap[1]);

  Serial.println("[Wi-Fi] Connecting...");
  int r = 0;
  while (wifiMulti.run() != WL_CONNECTED && r < 12) {
    delay(400);
    Serial.print(".");
    r++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] CONNECTED: " + WiFi.localIP().toString());
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(150);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(150);
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(150);
    digitalWrite(STATUS_LED_PIN, LOW);
  } else {
    Serial.println("\n[Wi-Fi] Retrying in background loop...");
  }
}

// =============================================================================
// 7. MAIN LOOP
// =============================================================================
void loop() {
  ensureWiFiConnected();
  unsigned long currentMillis = millis();

  if (currentMillis - lastPingTime >= PING_INTERVAL_MS) {
    lastPingTime = currentMillis;

    float distanceCm = getDistanceCM();

    if (isnan(distanceCm)) {
      currentStatus = "sensor_fault";
      dangerConsecutiveCount = 0;
      warningConsecutiveCount = 0;
      Serial.println("[FAULT] No valid echo (timeout / blind zone) -> sensor_fault");
      sendTelemetryToNADI(NAN, currentStatus, 0.0);
      return;
    }

    // Map distance to water level (200cm height - distance)
    float rawWaterLevelCm = SENSOR_HEIGHT_CM - distanceCm;
    if (rawWaterLevelCm < 0)
      rawWaterLevelCm = 0.0;
    float rawWaterLevelMeters = rawWaterLevelCm / 100.0;

    // Smooth with EWMA
    smoothedWaterLevelMeters =
        (EWMA_ALPHA_LEVEL * rawWaterLevelMeters) +
        ((1.0 - EWMA_ALPHA_LEVEL) * smoothedWaterLevelMeters);

    float deltaMeters = smoothedWaterLevelMeters - previousSmoothedMeters;
    float instantRateCmHr =
        (deltaMeters * 100.0) * (3600.0 / (PING_INTERVAL_MS / 1000.0));
    smoothedRiseRateCmHr = (EWMA_ALPHA_RATE * instantRateCmHr) +
                           ((1.0 - EWMA_ALPHA_RATE) * smoothedRiseRateCmHr);
    previousSmoothedMeters = smoothedWaterLevelMeters;

    // State Machine for Stage Demo
    if (smoothedWaterLevelMeters >= DANGER_THRESHOLD_M) {
      dangerConsecutiveCount++;
      warningConsecutiveCount = 0;
      if (dangerConsecutiveCount >= 2)
        currentStatus = "danger";
    } else if (smoothedWaterLevelMeters >= WARNING_THRESHOLD_M) {
      warningConsecutiveCount++;
      dangerConsecutiveCount = 0;
      if (warningConsecutiveCount >= 2)
        currentStatus = "warning";
    } else if (smoothedWaterLevelMeters < WARNING_CLEAR_M) {
      currentStatus = "safe";
      warningConsecutiveCount = 0;
      dangerConsecutiveCount = 0;
    }

    Serial.printf("[STAGE] Dist: %.1fcm -> Level: %.2fm [%s]\n", distanceCm,
                  smoothedWaterLevelMeters, currentStatus.c_str());

    sendTelemetryToNADI(smoothedWaterLevelMeters, currentStatus,
                        smoothedRiseRateCmHr);
  }
}