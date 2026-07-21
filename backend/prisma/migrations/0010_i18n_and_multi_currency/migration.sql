ALTER TABLE "users" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "workspaces" ADD COLUMN "base_currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "categories" ADD COLUMN "system_key" TEXT;
ALTER TABLE "transactions"
  ADD COLUMN "base_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fx_rate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  ADD COLUMN "fx_rate_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "fx_source" TEXT NOT NULL DEFAULT 'legacy';
UPDATE "transactions" SET "base_amount" = "amount", "currency" = COALESCE("currency", 'USD');
ALTER TABLE "budgets"
  ADD COLUMN "base_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fx_rate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  ADD COLUMN "fx_rate_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "fx_source" TEXT NOT NULL DEFAULT 'legacy';
UPDATE "budgets" SET "base_amount" = "amount", "currency" = COALESCE("currency", 'USD');
UPDATE "categories"
SET "system_key" = 'categories.' || TRIM(BOTH '.' FROM REGEXP_REPLACE(LOWER("name"), '[^a-z0-9]+', '.', 'g'))
WHERE "id" LIKE 'cat\_%' ESCAPE '\';