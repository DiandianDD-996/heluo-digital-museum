-- M01 read-only diagnostic for the museum schema on MySQL 8.
-- Run with an authorized SELECT-only account. Share only the three aggregate rows.
-- This estimates the app's Asia/Shanghai clock from the database's UTC clock;
-- compare business_now against the active application's independently verified time.
WITH audit_clock AS (
    SELECT UTC_TIMESTAMP(6) AS checked_at_utc,
           DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 8 HOUR) AS business_now
), audit_windows AS (
    SELECT 7 AS window_days
    UNION ALL SELECT 30
    UNION ALL SELECT 365
), audit_bounds AS (
    SELECT w.window_days, c.checked_at_utc, c.business_now,
           DATE(c.business_now) AS date_from,
           DATE_ADD(DATE(c.business_now), INTERVAL (w.window_days - 1) DAY) AS date_to
    FROM audit_windows w CROSS JOIN audit_clock c
), classified AS (
    SELECT b.*, s.id AS slot_id, s.status, s.capacity, s.reserved_people,
           CASE
               WHEN s.status <> 'OPEN' OR s.id IS NULL THEN NULL
               WHEN s.visit_date = b.date_from AND s.start_time <= TIME(b.business_now) THEN 'STARTED'
               WHEN s.reserved_people >= s.capacity THEN 'FULL'
               ELSE 'PUBLIC'
           END AS open_slot_class
    FROM audit_bounds b
    LEFT JOIN appointment_slots s ON s.visit_date BETWEEN b.date_from AND b.date_to
)
SELECT window_days, checked_at_utc, business_now, date_from, date_to,
       COUNT(slot_id) AS total_slots,
       SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_slots,
       SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) AS closed_slots,
       SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_slots,
       SUM(CASE WHEN open_slot_class = 'STARTED' THEN 1 ELSE 0 END) AS open_started_slots,
       SUM(CASE WHEN open_slot_class = 'FULL' THEN 1 ELSE 0 END) AS open_future_full_slots,
       SUM(CASE WHEN open_slot_class = 'PUBLIC' THEN 1 ELSE 0 END) AS public_slots,
       COALESCE(SUM(capacity), 0) AS capacity_total,
       COALESCE(SUM(reserved_people), 0) AS reserved_total,
       SUM(CASE WHEN open_slot_class = 'PUBLIC' THEN capacity - reserved_people ELSE 0 END) AS public_remaining
FROM classified
GROUP BY window_days, checked_at_utc, business_now, date_from, date_to
ORDER BY window_days;
