CREATE TABLE "recurring_budget_versions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "effective_month" VARCHAR(7) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "base_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recurring_budget_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recurring_budget_versions_month_check" CHECK ("effective_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "recurring_budget_versions_amount_check" CHECK ("amount" > 0 AND "base_amount" >= 0),
    CONSTRAINT "recurring_budget_versions_workspace_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recurring_budget_versions_category_fkey" FOREIGN KEY ("workspace_id", "category_id") REFERENCES "categories"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "recurring_budget_versions_workspace_category_month_key" ON "recurring_budget_versions"("workspace_id", "category_id", "effective_month");
CREATE INDEX "recurring_budget_versions_workspace_month_idx" ON "recurring_budget_versions"("workspace_id", "effective_month");

CREATE TABLE "budget_month_exclusions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    CONSTRAINT "budget_month_exclusions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "budget_month_exclusions_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "budget_month_exclusions_workspace_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "budget_month_exclusions_category_fkey" FOREIGN KEY ("workspace_id", "category_id") REFERENCES "categories"("workspace_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "budget_month_exclusions_workspace_category_month_key" ON "budget_month_exclusions"("workspace_id", "category_id", "month");
