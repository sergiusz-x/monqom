CREATE TABLE "monthly_plan_income_rules" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "effective_month" VARCHAR(7) NOT NULL CHECK ("effective_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  "currency" TEXT NOT NULL,
  "category_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspace_id", "effective_month")
);
INSERT INTO "monthly_plan_income_rules" ("id", "workspace_id", "effective_month", "currency", "category_ids")
SELECT 'legacy_' || md5("workspace_id" || ':' || "month"), "workspace_id", "month", "currency", "income_category_ids"
FROM "monthly_plans" WHERE "income_mode" = 'transactions' AND "income_planned" = true;
