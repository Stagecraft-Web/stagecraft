-- AlterTable: add failureCategory and repairAttempts to SiteJob
ALTER TABLE "SiteJob" ADD COLUMN "failureCategory" TEXT,
                      ADD COLUMN "repairAttempts"  INTEGER NOT NULL DEFAULT 0;

-- AlterTable: add failureCategory to ChangeRequest
ALTER TABLE "ChangeRequest" ADD COLUMN "failureCategory" TEXT;
