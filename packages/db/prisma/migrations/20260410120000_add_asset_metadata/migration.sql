-- AlterTable: add asset metadata columns and change temporaryStorageRef to TEXT
ALTER TABLE "AssetUpload" ADD COLUMN "alt" TEXT,
                           ADD COLUMN "caption" TEXT,
                           ADD COLUMN "credit" TEXT,
                           ADD COLUMN "usageSlot" TEXT;

ALTER TABLE "AssetUpload" ALTER COLUMN "temporaryStorageRef" TYPE TEXT;
