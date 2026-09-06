-- Strong ETags for machine-owned transaction replacement and deletion.
ALTER TABLE "transactions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
