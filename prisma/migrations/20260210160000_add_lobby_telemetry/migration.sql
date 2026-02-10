-- Add lobby telemetry fields
ALTER TABLE "Lobby" ADD COLUMN "telemetryMapName" TEXT;
ALTER TABLE "Lobby" ADD COLUMN "telemetryModeName" TEXT;
ALTER TABLE "Lobby" ADD COLUMN "telemetryPlayerCount" INTEGER;
ALTER TABLE "Lobby" ADD COLUMN "telemetryStatus" TEXT;
ALTER TABLE "Lobby" ADD COLUMN "telemetrySeq" INTEGER;
ALTER TABLE "Lobby" ADD COLUMN "telemetryEmittedAt" TIMESTAMP(3);
ALTER TABLE "Lobby" ADD COLUMN "telemetryUpdatedAt" TIMESTAMP(3);
