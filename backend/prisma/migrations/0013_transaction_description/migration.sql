ALTER TABLE "transactions" ADD COLUMN "description" TEXT;

UPDATE "transactions"
SET "description" = COALESCE(NULLIF(BTRIM("notes"), ''), 'Transaction');

ALTER TABLE "transactions" ALTER COLUMN "description" SET NOT NULL;
