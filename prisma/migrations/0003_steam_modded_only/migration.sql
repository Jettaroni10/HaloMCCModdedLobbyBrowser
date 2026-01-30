-- Steam-only platform enum
CREATE TYPE "Platform_new" AS ENUM ('STEAM');

ALTER TABLE "Lobby"
  ALTER COLUMN "platform" DROP DEFAULT;
ALTER TABLE "JoinRequest"
  ALTER COLUMN "requesterPlatform" DROP DEFAULT;

ALTER TABLE "Lobby"
  ALTER COLUMN "platform" TYPE "Platform_new"
  USING (CASE WHEN "platform" = 'STEAM' THEN 'STEAM' ELSE 'STEAM' END)::"Platform_new";
ALTER TABLE "JoinRequest"
  ALTER COLUMN "requesterPlatform" TYPE "Platform_new"
  USING (CASE WHEN "requesterPlatform" = 'STEAM' THEN 'STEAM' ELSE 'STEAM' END)::"Platform_new";

DROP TYPE "Platform";
ALTER TYPE "Platform_new" RENAME TO "Platform";

ALTER TABLE "Lobby"
  ALTER COLUMN "platform" SET DEFAULT 'STEAM';
ALTER TABLE "JoinRequest"
  ALTER COLUMN "requesterPlatform" SET DEFAULT 'STEAM';

-- Modded-only defaults and required fields
UPDATE "Lobby" SET "isModded" = true WHERE "isModded" = false OR "isModded" IS NULL;
UPDATE "Lobby" SET "workshopCollectionUrl" = '' WHERE "workshopCollectionUrl" IS NULL;
UPDATE "Lobby" SET "slotsTotal" = 16 WHERE "slotsTotal" IS NULL;

ALTER TABLE "Lobby"
  ALTER COLUMN "isModded" SET DEFAULT true,
  ALTER COLUMN "requiresEacOff" SET DEFAULT true,
  ALTER COLUMN "workshopCollectionUrl" SET NOT NULL,
  ALTER COLUMN "slotsTotal" SET DEFAULT 16,
  ALTER COLUMN "slotsTotal" SET NOT NULL;
