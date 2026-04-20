-- AlterTable: Add standardized location code to rack_levels (A-03-02 format)
ALTER TABLE "rack_levels" ADD COLUMN "code" TEXT;

-- AlterTable: Add from/to location tracking to transactions for MOVE traceability
ALTER TABLE "transactions" ADD COLUMN "from_location_code" TEXT;
ALTER TABLE "transactions" ADD COLUMN "to_location_code" TEXT;

-- CreateIndex: Unique constraint on rack_levels.code
CREATE UNIQUE INDEX "rack_levels_code_key" ON "rack_levels"("code");

-- CreateIndex: Index for quick lookup by code
CREATE INDEX "rack_levels_code_idx" ON "rack_levels"("code");
