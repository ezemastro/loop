BEGIN;

WITH template_totals AS (
  SELECT
    mt.id AS mission_template_id,
    COALESCE(
      NULLIF(SUBSTRING(mt.key FROM '([0-9]+)$'), '')::int,
      1
    ) AS total
  FROM mission_templates mt
),
missing_assignments AS (
  SELECT
    u.id AS user_id,
    tt.mission_template_id,
    tt.total
  FROM users u
  CROSS JOIN template_totals tt
  WHERE NOT EXISTS (
    SELECT 1
    FROM user_missions um
    WHERE um.user_id = u.id
      AND um.mission_template_id = tt.mission_template_id
  )
)
INSERT INTO user_missions (
  user_id,
  mission_template_id,
  progress,
  completed,
  completed_at
)
SELECT
  ma.user_id,
  ma.mission_template_id,
  jsonb_build_object('current', 0, 'total', ma.total) AS progress,
  FALSE AS completed,
  NULL AS completed_at
FROM missing_assignments ma;

COMMIT;