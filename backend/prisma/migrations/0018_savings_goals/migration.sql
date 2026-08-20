CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_amount" INTEGER NOT NULL,
    "initial_amount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "plan_start_month" DATE NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goal_operations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "goal_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goals_workspace_id_id_key" ON "goals"("workspace_id", "id");
CREATE INDEX "goals_workspace_id_archived_at_idx" ON "goals"("workspace_id", "archived_at");
CREATE INDEX "goals_workspace_id_target_date_idx" ON "goals"("workspace_id", "target_date");
CREATE UNIQUE INDEX "goal_operations_workspace_id_id_key" ON "goal_operations"("workspace_id", "id");
CREATE INDEX "goal_operations_workspace_id_goal_id_date_idx" ON "goal_operations"("workspace_id", "goal_id", "date");

ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goal_operations" ADD CONSTRAINT "goal_operations_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goal_operations" ADD CONSTRAINT "goal_operations_workspace_id_goal_id_fkey"
    FOREIGN KEY ("workspace_id", "goal_id") REFERENCES "goals"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goals" ADD CONSTRAINT "goals_target_amount_positive" CHECK ("target_amount" > 0);
ALTER TABLE "goals" ADD CONSTRAINT "goals_initial_amount_nonnegative" CHECK ("initial_amount" >= 0);
ALTER TABLE "goal_operations" ADD CONSTRAINT "goal_operations_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "goal_operations" ADD CONSTRAINT "goal_operations_type_valid" CHECK ("type" IN ('deposit', 'withdrawal'));
