-- Add optional Firebase UID for auth linking
ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT;

-- Unique index for Firebase UID when present
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
