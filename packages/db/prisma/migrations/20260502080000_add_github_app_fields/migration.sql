-- Add GitHub App fields to Site for the publish-token broker (ADR-008).

ALTER TABLE "Site" ADD COLUMN "githubInstallationId" INTEGER;
ALTER TABLE "Site" ADD COLUMN "githubAppSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Site" ADD COLUMN "brokerSecretHash" TEXT;
