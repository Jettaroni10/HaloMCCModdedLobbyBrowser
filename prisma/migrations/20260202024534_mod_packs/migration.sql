-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "modPackId" TEXT,
ALTER COLUMN "workshopCollectionUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Mod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workshopUrl" TEXT NOT NULL,
    "workshopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerUserId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModPackMod" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ModPackMod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mod_workshopUrl_key" ON "Mod"("workshopUrl");

-- CreateIndex
CREATE INDEX "mod_pack_mod_sort_idx" ON "ModPackMod"("packId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "mod_pack_mod_unique" ON "ModPackMod"("packId", "modId");

-- AddForeignKey
ALTER TABLE "Lobby" ADD CONSTRAINT "Lobby_modPackId_fkey" FOREIGN KEY ("modPackId") REFERENCES "ModPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModPack" ADD CONSTRAINT "ModPack_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModPackMod" ADD CONSTRAINT "ModPackMod_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ModPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModPackMod" ADD CONSTRAINT "ModPackMod_modId_fkey" FOREIGN KEY ("modId") REFERENCES "Mod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
