-- ============================================================
-- C1: Occupancy Heatmap RPC
-- No new tables or columns required.
-- All data exists in: reservations, room_blocks, beds, rooms, locations
-- Indexes already covering this query:
--   reservations_quote_availability_idx(room_id, check_in, check_out, status)
--   room_blocks_quote_availability_idx(room_id, start_date, end_date, status)
-- ============================================================

DROP FUNCTION IF EXISTS get_occupancy_heatmap(date, date, uuid);

CREATE OR REPLACE FUNCTION get_occupancy_heatmap(
  p_start_date  date,
  p_end_date    date,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  day               date,
  location_id       uuid,
  location_name     text,
  total_beds        integer,
  occupied_beds     integer,
  blocked_beds      integer,
  available_beds    integer,
  occupancy_pct     numeric,
  revenue           numeric,
  avg_rate          numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_max_days integer := 90;
BEGIN
  -- Guard: max 90-day range
  IF (p_end_date - p_start_date) > v_max_days THEN
    RAISE EXCEPTION 'Date range exceeds maximum of % days', v_max_days;
  END IF;

  RETURN QUERY
  WITH
  -- Expand date range into individual days
  date_series AS (
    SELECT d::date AS day
    FROM generate_series(p_start_date, p_end_date - 1, '1 day'::interval) d
  ),

  -- Build the universe of available beds per location
  bed_universe AS (
    SELECT
      b.id         AS bed_id,
      b.room_id,
      r.location_id,
      l.name       AS location_name,
      COALESCE(r.rate_per_night, 0) AS rate_per_night
    FROM beds b
    JOIN rooms r      ON r.id = b.room_id
    JOIN locations l  ON l.id = r.location_id
    WHERE b.is_available = true
      AND (p_location_id IS NULL OR r.location_id = p_location_id)
  ),

  -- Count available beds per location (constant denominator)
  bed_counts AS (
    SELECT
      bu.location_id,
      COUNT(bu.bed_id)::integer AS total_beds
    FROM bed_universe bu
    GROUP BY bu.location_id
  ),

  -- For each (day, bed_id) find active reservations spanning that day
  reservation_hits AS (
    SELECT
      ds.day,
      bu.bed_id,
      bu.location_id,
      bu.rate_per_night,
      res.id        AS reservation_id,
      res.total_amount,
      res.check_in,
      res.check_out
    FROM date_series ds
    CROSS JOIN bed_universe bu
    LEFT JOIN reservations res
      ON  res.bed_id    = bu.bed_id
      AND res.status    NOT IN ('cancelled', 'void', 'no_show')
      AND ds.day        >= res.check_in
      AND ds.day        <  res.check_out
  ),

  -- For each (day, bed_id) find active room blocks spanning that day
  -- room_blocks are at room level (not bed level), so we expand per bed
  block_hits AS (
    SELECT
      ds.day,
      bu.bed_id,
      bu.location_id,
      rb.id AS block_id
    FROM date_series ds
    CROSS JOIN bed_universe bu
    LEFT JOIN room_blocks rb
      ON  rb.room_id    = bu.room_id
      AND rb.status     = 'active'
      AND ds.day        >= rb.start_date
      AND ds.day        <  rb.end_date
    WHERE rb.id IS NOT NULL
  ),

  -- Aggregate per (day, location)
  daily_agg AS (
    SELECT
      rh.day,
      rh.location_id,
      -- Count distinct beds with an active reservation
      COUNT(DISTINCT rh.bed_id) FILTER (WHERE rh.reservation_id IS NOT NULL)::integer
        AS occupied_beds,
      -- Pro-rated daily revenue: total_amount / nights for each active reservation
      -- Each (day, bed_id) contributes exactly once (LEFT JOIN picks one row per bed per day)
      COALESCE(SUM(
        CASE
          WHEN rh.reservation_id IS NOT NULL
          THEN COALESCE(rh.total_amount, rh.rate_per_night)
               / GREATEST((rh.check_out - rh.check_in), 1)
          ELSE 0
        END
      ), 0) AS revenue
    FROM reservation_hits rh
    GROUP BY rh.day, rh.location_id
  ),

  -- Block counts per (day, location)
  daily_blocks AS (
    SELECT
      bh.day,
      bh.location_id,
      COUNT(DISTINCT bh.bed_id)::integer AS blocked_beds
    FROM block_hits bh
    GROUP BY bh.day, bh.location_id
  )

  SELECT
    da.day,
    da.location_id,
    l.name                                                                AS location_name,
    bc.total_beds,
    da.occupied_beds,
    COALESCE(db.blocked_beds, 0)                                         AS blocked_beds,
    GREATEST(bc.total_beds - da.occupied_beds - COALESCE(db.blocked_beds, 0), 0) AS available_beds,
    CASE WHEN bc.total_beds > 0
         THEN ROUND((da.occupied_beds::numeric / bc.total_beds) * 100, 1)
         ELSE 0
    END                                                                   AS occupancy_pct,
    ROUND(da.revenue, 0)                                                  AS revenue,
    CASE WHEN da.occupied_beds > 0
         THEN ROUND(da.revenue / da.occupied_beds, 0)
         ELSE 0
    END                                                                   AS avg_rate
  FROM daily_agg da
  JOIN bed_counts bc ON bc.location_id = da.location_id
  LEFT JOIN daily_blocks db ON db.day = da.day AND db.location_id = da.location_id
  LEFT JOIN locations l ON l.id = da.location_id
  ORDER BY da.day, l.name;
END;
$$;

-- Security: callable by authenticated + service role
GRANT EXECUTE ON FUNCTION get_occupancy_heatmap(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_occupancy_heatmap(date, date, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_occupancy_heatmap(date, date, uuid) TO anon;
