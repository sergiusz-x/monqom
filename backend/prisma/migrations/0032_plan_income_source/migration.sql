ALTER TABLE "monthly_plans"
  ADD COLUMN "income_mode" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "income_category_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT "monthly_plans_income_mode_check" CHECK ("income_mode" IN ('manual', 'transactions'));
