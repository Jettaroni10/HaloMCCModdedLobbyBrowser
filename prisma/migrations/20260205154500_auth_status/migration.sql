-- CreateEnum
CREATE TYPE "AuthStatus" AS ENUM ('ACTIVE', 'LEGACY', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('FIREBASE', 'LEGACY');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "authStatus" "AuthStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "authProvider" "AuthProvider",
ADD COLUMN "legacyReason" TEXT,
ADD COLUMN "disabledAt" TIMESTAMP(3);
