-- ============================================================================
-- Migration 017: Drop get_nearest_evac_centers (from 008).
-- It reads nadi_bencana_centers, which 013 dropped, so every call errors.
-- Nothing in the app calls it.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_nearest_evac_centers(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
