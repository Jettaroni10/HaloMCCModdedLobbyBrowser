-- CreateEnum
CREATE TYPE "Game" AS ENUM ('H1', 'H2', 'H3', 'ODST', 'REACH', 'H4');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('NA', 'EU', 'OCE', 'SA', 'AS');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('STEAM', 'XBOX_FUTURE');

-- CreateEnum
CREATE TYPE "Voice" AS ENUM ('MIC_REQUIRED', 'MIC_OPTIONAL', 'NO_MIC');

-- CreateEnum
CREATE TYPE "Vibe" AS ENUM ('CASUAL', 'SWEATY', 'CHAOS', 'RP', 'OTHER');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'LOBBY', 'REQUEST');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('SPAM', 'HARASSMENT', 'IMPERSONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "steamName" TEXT,
    "xboxGamertag" TEXT,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "game" "Game" NOT NULL,
    "mode" TEXT NOT NULL,
    "map" TEXT NOT NULL,
    "region" "Region" NOT NULL,
    "platform" "Platform" NOT NULL,
    "voice" "Voice" NOT NULL,
    "vibe" "Vibe" NOT NULL,
    "tags" TEXT[] NOT NULL,
    "rulesNote" TEXT NOT NULL,
    "friendsOnly" BOOLEAN NOT NULL DEFAULT false,
    "slotsTotal" INTEGER,
    "slotsOpen" INTEGER,
    "isModded" BOOLEAN NOT NULL DEFAULT false,
    "workshopCollectionUrl" TEXT,
    "workshopItemUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requiresEacOff" BOOLEAN NOT NULL DEFAULT false,
    "modNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterPlatform" "Platform" NOT NULL,
    "requesterHandleText" TEXT NOT NULL,
    "note" TEXT,
    "confirmedSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedEacOff" BOOLEAN NOT NULL DEFAULT false,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "details" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX "lobbies_browse_idx" ON "Lobby"("isActive", "expiresAt", "region", "game", "platform");

-- CreateIndex
CREATE INDEX "join_requests_idx" ON "JoinRequest"("lobbyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_blocked_key" ON "Block"("blockerUserId", "blockedUserId");

-- CreateIndex
CREATE INDEX "rate_limit_events_idx" ON "RateLimitEvent"("userId", "key", "createdAt");

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateLimitEvent" ADD CONSTRAINT "RateLimitEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
