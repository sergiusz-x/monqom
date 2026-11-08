ALTER TABLE "monthly_goal_allocations" ADD COLUMN "goal_name" TEXT;
UPDATE "monthly_goal_allocations" a SET "goal_name" = g."name" FROM "goals" g WHERE g."id" = a."goal_id" AND g."workspace_id" = a."workspace_id";
ALTER TABLE "monthly_goal_allocations" ALTER COLUMN "goal_name" SET NOT NULL;
ALTER TABLE "monthly_goal_allocations" DROP CONSTRAINT "monthly_goal_allocations_goal_fkey";
ALTER TABLE "monthly_goal_allocations" ALTER COLUMN "goal_id" DROP NOT NULL;
ALTER TABLE "monthly_goal_allocations" ADD CONSTRAINT "monthly_goal_allocations_goal_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
