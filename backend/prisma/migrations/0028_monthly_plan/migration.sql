CREATE TABLE "monthly_plans" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "month" VARCHAR(7) NOT NULL,
  "currency" TEXT NOT NULL,
  "funds" INTEGER NOT NULL,
  "confirmed_at" TIMESTAMP(3) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monthly_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_plans_funds_check" CHECK ("funds" >= 0),
  CONSTRAINT "monthly_plans_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT "monthly_plans_workspace_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "monthly_plans_workspace_month_key" ON "monthly_plans"("workspace_id", "month");
CREATE UNIQUE INDEX "monthly_plans_workspace_id_key" ON "monthly_plans"("workspace_id", "id");

CREATE TABLE "monthly_goal_allocations" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "goal_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  CONSTRAINT "monthly_goal_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monthly_goal_allocations_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "monthly_goal_allocations_plan_fkey" FOREIGN KEY ("workspace_id", "plan_id") REFERENCES "monthly_plans"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "monthly_goal_allocations_goal_fkey" FOREIGN KEY ("workspace_id", "goal_id") REFERENCES "goals"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "monthly_goal_allocations_workspace_plan_goal_key" ON "monthly_goal_allocations"("workspace_id", "plan_id", "goal_id");
CREATE INDEX "monthly_goal_allocations_workspace_goal_idx" ON "monthly_goal_allocations"("workspace_id", "goal_id");
