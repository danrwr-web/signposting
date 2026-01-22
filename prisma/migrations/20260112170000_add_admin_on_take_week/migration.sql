-- CreateTable: AdminOnTakeWeek
CREATE TABLE IF NOT EXISTS "AdminOnTakeWeek" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "weekCommencing" DATE NOT NULL,
    "gpName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminOnTakeWeek_pkey" PRIMARY KEY ("id")
);

-- Unique + indexes
CREATE UNIQUE INDEX IF NOT EXISTS "AdminOnTakeWeek_surgeryId_weekCommencing_key" ON "AdminOnTakeWeek" ("surgeryId", "weekCommencing");
CREATE INDEX IF NOT EXISTS "AdminOnTakeWeek_surgeryId_weekCommencing_idx" ON "AdminOnTakeWeek" ("surgeryId", "weekCommencing");

-- FK: AdminOnTakeWeek -> Surgery
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminOnTakeWeek_surgeryId_fkey') THEN
    ALTER TABLE "AdminOnTakeWeek" ADD CONSTRAINT "AdminOnTakeWeek_surgeryId_fkey"
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Best-effort backfill from per-day rota:
-- For each surgery + week:
-- - Use Monday's value if present
-- - Else use the first non-empty day in the week
WITH rota AS (
  SELECT
    "surgeryId",
    date_trunc('week', "date")::date AS "weekCommencing",
    ("date"::date = date_trunc('week', "date")::date) AS "isMonday",
    "date"::date AS "dayDate",
    NULLIF(BTRIM("name"), '') AS "gpName"
  FROM "AdminDutyRotaEntry"
),
best AS (
  SELECT DISTINCT ON ("surgeryId", "weekCommencing")
    "surgeryId",
    "weekCommencing",
    "gpName"
  FROM rota
  WHERE "gpName" IS NOT NULL
  ORDER BY
    "surgeryId",
    "weekCommencing",
    CASE WHEN "isMonday" THEN 0 ELSE 1 END,
    "dayDate" ASC
)
INSERT INTO "AdminOnTakeWeek" ("id", "surgeryId", "weekCommencing", "gpName", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text),
  b."surgeryId",
  b."weekCommencing",
  b."gpName",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM best b
ON CONFLICT ("surgeryId", "weekCommencing") DO NOTHING;

