-- AlterEnum: new task-activity types for delete/restore
ALTER TYPE "ActivityType" ADD VALUE 'DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'RESTORED';

-- CreateEnum: marks a workflow column's role
CREATE TYPE "StatusKind" AS ENUM ('NORMAL', 'DELETED');

-- AlterTable: tag each workflow status with its kind (existing rows = NORMAL)
ALTER TABLE "WorkflowStatus" ADD COLUMN     "kind" "StatusKind" NOT NULL DEFAULT 'NORMAL';

-- Backfill: give every existing project a system "Deleted" column, pinned last.
INSERT INTO "WorkflowStatus" ("id", "projectId", "name", "color", "position", "kind")
SELECT
  gen_random_uuid()::text,
  p."id",
  'Deleted',
  '#9ca3af',
  COALESCE(mp."maxpos", -1) + 1,
  'DELETED'
FROM "Project" p
LEFT JOIN (
  SELECT "projectId", MAX("position") AS "maxpos"
  FROM "WorkflowStatus"
  GROUP BY "projectId"
) mp ON mp."projectId" = p."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkflowStatus" ws
  WHERE ws."projectId" = p."id" AND ws."kind" = 'DELETED'
);
