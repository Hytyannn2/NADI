-- ============================================
-- PATCH: Add missing BME280 columns to existing tables
-- Run this in Supabase SQL Editor if you already ran
-- the old version of 005_sensor_telemetry.sql
-- ============================================

-- 1. Add BME280 columns to SENSORS table (if missing)
ALTER TABLE public.nadi_bencana_sensors
  ADD COLUMN IF NOT EXISTS temperature_c REAL,
  ADD COLUMN IF NOT EXISTS humidity_pct SMALLINT,
  ADD COLUMN IF NOT EXISTS pressure_hpa REAL;

ALTER TABLE public.nadi_bencana_sensors
  ADD COLUMN IF NOT EXISTS rise_rate_cm_hr REAL DEFAULT 0;

ALTER TABLE public.nadi_bencana_sensors
  ADD COLUMN IF NOT EXISTS sensor_type TEXT DEFAULT 'ultrasonic';

-- 2. Add BME280 columns to READINGS table (if missing)
ALTER TABLE public.nadi_bencana_sensor_readings
  ADD COLUMN IF NOT EXISTS temperature_c REAL,
  ADD COLUMN IF NOT EXISTS humidity_pct SMALLINT,
  ADD COLUMN IF NOT EXISTS pressure_hpa REAL;
