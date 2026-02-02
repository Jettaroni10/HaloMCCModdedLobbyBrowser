import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidGamertag, normalizeHandleText } from "@/lib/validation";
import { isReachColor } from "@/lib/reach-colors";
import { absoluteUrl } from "@/lib/url";
import { HALO_GAMES } from "@/data/haloGames";
import { HALO_WEAPONS } from "@/data/haloWeapons";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json") ? await request.json() : null;
  const formData = body ? null : await request.formData();

  const gamertag = normalizeHandleText(
    body?.gamertag ?? formData?.get("gamertag"),
    32
  );
  const emailRaw = body?.email ?? formData?.get("email");
  const email =
    typeof emailRaw === "string" && emailRaw.trim().length > 0
      ? emailRaw.toLowerCase().trim()
      : "";
  const rawColor = body?.nametagColor ?? formData?.get("nametagColor");
  const nametagColor =
    typeof rawColor === "string" && rawColor.trim().length > 0
      ? rawColor.trim()
      : "";
  const rawFavoriteGame = body?.favoriteGameId ?? formData?.get("favoriteGameId");
  const favoriteGameId =
    typeof rawFavoriteGame === "string" ? rawFavoriteGame.trim() : "";
  const rawFavoriteWeapon =
    body?.favoriteWeaponId ?? formData?.get("favoriteWeaponId");
  const favoriteWeaponId =
    typeof rawFavoriteWeapon === "string" ? rawFavoriteWeapon.trim() : "";

  if (!gamertag) {
    return NextResponse.json(
      { error: "Gamertag is required." },
      { status: 400 }
    );
  }
  if (!isValidGamertag(gamertag)) {
    return NextResponse.json(
      {
        error:
          "Gamertag must be 3-24 characters and use letters, numbers, spaces, or underscore.",
      },
      { status: 400 }
    );
  }
  if (!email) {
    return NextResponse.json(
      { error: "Email is required." },
      { status: 400 }
    );
  }
  if (nametagColor && !isReachColor(nametagColor)) {
    return NextResponse.json(
      { error: "Nametag color must be selected from the palette." },
      { status: 400 }
    );
  }
  if (
    favoriteGameId &&
    !HALO_GAMES.some((game) => game.id === favoriteGameId)
  ) {
    return NextResponse.json(
      { error: "Favorite game selection is invalid." },
      { status: 400 }
    );
  }
  if (
    favoriteWeaponId &&
    !HALO_WEAPONS.some((weapon) => weapon.id === favoriteWeaponId)
  ) {
    return NextResponse.json(
      { error: "Favorite weapon selection is invalid." },
      { status: 400 }
    );
  }

  const existingEmail = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      id: { not: user.id },
    },
    select: { id: true },
  });
  if (existingEmail) {
    return NextResponse.json(
      { error: "That email is already in use." },
      { status: 409 }
    );
  }

  const existingGamertag = await prisma.user.findFirst({
    where: {
      gamertag: { equals: gamertag, mode: "insensitive" },
      id: { not: user.id },
    },
    select: { id: true },
  });
  if (existingGamertag) {
    return NextResponse.json(
      { error: "That gamertag is already in use." },
      { status: 409 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      gamertag,
      email,
      needsGamertag: false,
      ...(nametagColor ? { nametagColor } : {}),
      favoriteGameId: favoriteGameId || null,
      favoriteWeaponId: favoriteWeaponId || null,
    },
  });

  const isJson = (request.headers.get("content-type") ?? "").includes(
    "application/json"
  );
  if (isJson) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(absoluteUrl(request, "/settings/profile"));
}

