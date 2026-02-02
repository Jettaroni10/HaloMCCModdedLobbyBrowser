import { NextResponse } from "next/server";
import { prisma, modPacksSupported } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeText } from "@/lib/validation";
import { normalizeModName, normalizeWorkshopUrl } from "@/lib/mods";

const LIMITS = {
  name: 80,
  description: 240,
};

type ModInput = {
  name?: string;
  workshopUrl?: string;
  isOptional?: boolean;
};

export async function GET() {
  if (!modPacksSupported) {
    return NextResponse.json(
      { error: "Mod packs are unavailable. Run the latest migrations." },
      { status: 501 }
    );
  }
  const user = await getCurrentUser();
  if (user?.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const packs = await prisma.modPack.findMany({
    where: user
      ? {
          OR: [
            { isPublic: true },
            { ownerUserId: user.id },
          ],
        }
      : { isPublic: true },
    orderBy: { createdAt: "desc" },
    include: {
      modPackMods: {
        orderBy: { sortOrder: "asc" },
        include: { mod: true },
      },
    },
  });

  return NextResponse.json(
    packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      ownerUserId: pack.ownerUserId,
      isPublic: pack.isPublic,
      mods: pack.modPackMods.map((entry) => ({
        id: entry.mod.id,
        name: entry.mod.name,
        workshopUrl: entry.mod.workshopUrl,
        workshopId: entry.mod.workshopId,
        isOptional: entry.isOptional,
        sortOrder: entry.sortOrder,
      })),
    }))
  );
}

export async function POST(request: Request) {
  if (!modPacksSupported) {
    return NextResponse.json(
      { error: "Mod packs are unavailable. Run the latest migrations." },
      { status: 501 }
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { name?: string; description?: string; isPublic?: boolean; mods?: ModInput[] }
    | null;

  const name = normalizeText(body?.name, LIMITS.name);
  const description = normalizeText(body?.description, LIMITS.description);
  const isPublic = Boolean(body?.isPublic);
  const mods = Array.isArray(body?.mods) ? body?.mods : [];

  if (!name) {
    return NextResponse.json({ error: "Pack name is required." }, { status: 400 });
  }
  if (mods.length === 0) {
    return NextResponse.json({ error: "Add at least one mod." }, { status: 400 });
  }

  const normalizedMods = mods
    .map((mod, index) => {
      const workshopRaw = typeof mod.workshopUrl === "string" ? mod.workshopUrl : "";
      const normalized = normalizeWorkshopUrl(workshopRaw);
      if (!normalized) return null;
      const nameValue = normalizeModName(mod.name ?? "");
      return {
        index,
        workshopUrl: normalized.url,
        workshopId: normalized.workshopId,
        name: nameValue || normalized.url,
        isOptional: Boolean(mod.isOptional),
      };
    })
    .filter(Boolean) as Array<{
    index: number;
    workshopUrl: string;
    workshopId?: string;
    name: string;
    isOptional: boolean;
  }>;

  if (normalizedMods.length === 0) {
    return NextResponse.json({ error: "Valid mod URLs required." }, { status: 400 });
  }

  const pack = await prisma.$transaction(async (tx) => {
    const createdPack = await tx.modPack.create({
      data: {
        name,
        description: description || null,
        ownerUserId: user.id,
        isPublic,
      },
    });

    const modRecords = await Promise.all(
      normalizedMods.map((mod) =>
        tx.mod.upsert({
          where: { workshopUrl: mod.workshopUrl },
          update: {
            name: mod.name,
            workshopId: mod.workshopId,
          },
          create: {
            name: mod.name,
            workshopUrl: mod.workshopUrl,
            workshopId: mod.workshopId,
          },
        })
      )
    );

    await tx.modPackMod.createMany({
      data: modRecords.map((mod, idx) => ({
        packId: createdPack.id,
        modId: mod.id,
        sortOrder: normalizedMods[idx].index,
        isOptional: normalizedMods[idx].isOptional,
      })),
      skipDuplicates: true,
    });

    return createdPack;
  });

  return NextResponse.json({ id: pack.id });
}
