-- Add gamertag identity
ALTER TABLE "User" ADD COLUMN "gamertag" TEXT;
ALTER TABLE "User" ADD COLUMN "needsGamertag" BOOLEAN NOT NULL DEFAULT false;

-- Ensure email is present for NOT NULL constraint
UPDATE "User"
SET "email" = CONCAT('user+', "id", '@example.invalid')
WHERE "email" IS NULL;

-- Backfill gamertag from existing identity fields
UPDATE "User"
SET "gamertag" = NULLIF(BTRIM("handle"), '')
WHERE "gamertag" IS NULL AND "handle" IS NOT NULL;

UPDATE "User"
SET "gamertag" = NULLIF(BTRIM("displayName"), '')
WHERE "gamertag" IS NULL AND "displayName" IS NOT NULL;

UPDATE "User"
SET "gamertag" = NULLIF(BTRIM(split_part("email", '@', 1)), '')
WHERE "gamertag" IS NULL AND "email" IS NOT NULL;

-- Final fallback to unique placeholder + mark completion required
UPDATE "User"
SET "gamertag" = CONCAT('user-', "id"),
    "needsGamertag" = true
WHERE "gamertag" IS NULL;

-- Relax legacy fields
ALTER TABLE "User" ALTER COLUMN "handle" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "displayName" DROP NOT NULL;

-- Enforce required identity fields
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "gamertag" SET NOT NULL;

-- Uniqueness (case-sensitive + case-insensitive)
CREATE UNIQUE INDEX "User_gamertag_key" ON "User"("gamertag");
CREATE UNIQUE INDEX "User_gamertag_lower_key" ON "User"(LOWER("gamertag"));