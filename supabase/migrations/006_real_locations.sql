-- Migration 006: Evacuation Centers & Sensor GPS Positioning
-- Adds GPS coordinates to evacuation centers and registers verified Kelantan hardware sensors.

-- 1. Add lat/lng to nadi_bencana_centers table
ALTER TABLE public.nadi_bencana_centers
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- 2. Drop name unique constraint on sensors if it exists to allow dev_eui as primary unique key
ALTER TABLE public.nadi_bencana_sensors DROP CONSTRAINT IF EXISTS uq_sensor_name;

-- 3. Clear old test centers and insert real verified Kelantan Evacuation Centers (PPS)
DELETE FROM public.nadi_bencana_centers;

INSERT INTO public.nadi_bencana_centers (name, district, capacity, type, lat, lng)
VALUES 
  ('SK Kubang Kerian', 'Kota Bharu', 500, 'Sekolah', 6.092444, 102.274583),
  ('Masjid Muhammadi', 'Kota Bharu', 800, 'Masjid', 6.132155, 102.236688),
  ('SK Kuala Krai', 'Kuala Krai', 400, 'Sekolah', 5.534744, 102.197519),
  ('SK Gua Musang', 'Gua Musang', 350, 'Sekolah', 4.882100, 101.964500),
  ('Dewan Sultan Tanah Merah', 'Tanah Merah', 300, 'Dewan', 5.808300, 102.148100);

-- 4. Update or insert real sensor coordinates by dev_eui (unique hardware key)
INSERT INTO public.nadi_bencana_sensors 
  (name, location, lat, lng, dev_eui, sensor_type, status, water_level)
VALUES 
  ('Lembah Sireh Node A', 'Sungai Kelantan, Lembah Sireh', 6.125100, 102.234500, '0018B20000000001', 'ultrasonic', 'safe', 25.0),
  ('Gua Musang Node B', 'Sungai Galas, Gua Musang', 4.886700, 101.963400, '0018B20000000002', 'ultrasonic', 'safe', 30.0),
  ('SK Kubang Kerian Node C', 'Kubang Kerian, Kota Bharu', 6.092444, 102.274583, '0018B20000000003', 'ultrasonic', 'safe', 20.0),
  ('SK Kuala Krai Node D', 'Sungai Kelantan, Kuala Krai', 5.534744, 102.197519, '0018B20000000004', 'ultrasonic', 'safe', 35.0)
ON CONFLICT (dev_eui) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  water_level = EXCLUDED.water_level;
