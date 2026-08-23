-- Migration 005: Sensor Telemetry & Historical Readings
-- Expands IoT sensor table with BME280 metrics and creates time-series readings history table.

-- ==========================================
-- 1. EXPAND SENSORS TABLE FOR REAL HARDWARE
-- ==========================================

-- TTN device identifier — the link between physical hardware and this row
ALTER TABLE public.nadi_bencana_sensors
  ADD COLUMN IF NOT EXISTS dev_eui TEXT UNIQUE;

-- Core telemetry columns the webhook will populate on every uplink
ALTER TABLE public.nadi_bencana_sensors
  ADD COLUMN IF NOT EXISTS battery_pct SMALLINT,
  ADD COLUMN IF NOT EXISTS rssi_dbm SMALLINT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;

-- BME280 environmental columns (temperature, humidity, barometric pressure)
ALTER TABLE public.nadi_bencana_sensors
  ADD COLUMN IF NOT EXISTS temperature_c REAL,
  ADD COLUMN IF NOT EXISTS humidity_pct SMALLINT,
  ADD COLUMN IF NOT EXISTS pressure_hpa REAL;

-- Rise rate tracking — calculated server-side from last N readings
ALTER TABLE public.nadi_bencana_sensors
  ADD COLUMN IF NOT EXISTS rise_rate_cm_hr REAL DEFAULT 0;

-- Sensor classification for future expansion (ultrasonic, pressure, radar)
ALTER TABLE public.nadi_bencana_sensors
  ADD COLUMN IF NOT EXISTS sensor_type TEXT DEFAULT 'ultrasonic';

-- ==========================================
-- 2. CREATE SENSOR READINGS HISTORY TABLE
-- ==========================================
-- Store every single uplink. Even if the UI doesn't chart
-- it yet, we want this data from day 1 for analysis later.

CREATE TABLE IF NOT EXISTS public.nadi_bencana_sensor_readings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sensor_id UUID REFERENCES public.nadi_bencana_sensors(id) ON DELETE CASCADE,
  water_level REAL NOT NULL,
  battery_pct SMALLINT,
  rssi_dbm SMALLINT,
  temperature_c REAL,
  humidity_pct SMALLINT,
  pressure_hpa REAL,
  flags SMALLINT DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nadi_bencana_sensor_readings ENABLE ROW LEVEL SECURITY;

-- Readings are public data (flood safety info)
DROP POLICY IF EXISTS "Public read sensor readings" ON public.nadi_bencana_sensor_readings;
CREATE POLICY "Public read sensor readings"
  ON public.nadi_bencana_sensor_readings FOR SELECT USING (true);

-- Only service role (webhook API) can insert readings
-- No user-facing INSERT policy needed — webhook uses service role key

-- Time-series query index: "give me the last N readings for sensor X"
CREATE INDEX IF NOT EXISTS idx_readings_sensor_time
  ON public.nadi_bencana_sensor_readings (sensor_id, recorded_at DESC);

-- ==========================================
-- 3. ENABLE REALTIME FOR READINGS
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'nadi_bencana_sensor_readings'
      AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nadi_bencana_sensor_readings;
  END IF;
END $$;
