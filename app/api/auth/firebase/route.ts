import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { normalizeText } from "@/lib/validation";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type FirebaseAuthPayload = {
  idToken?: string;
  gamertag?: string;
};

function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

async function findUserByGamertag(gamertag: string) {
  return prisma.user.findFirst({
    where: { gamertag: { equals: gamertag, mode: "insensitive" } },
  });
}

async function generateUniqueGamertag(seed: string) {
  let candidate = seed;
  let suffix = 0;
  while (await findUserByGamertag(candidate)) {
    suffix += 1;
    candidate = `${seed}-${suffix}`;
  }
  return candidate;
}

export async function POST(request: Request) {
  let body: FirebaseAuthPayload;
  try {
    body = (await request.json()) as FirebaseAuthPayload;
  } catch {
    return jsonError("Invalid request payload.");
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) {
    return jsonError("Missing id token.");
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return jsonError("Invalid or expired token.", 401);
  }

  const email = decoded.email?.toLowerCase().trim();
  if (!email) {
    return jsonError("Email not available for this account.", 400, "no_email");
  }

  const requestedGamertag = normalizeText(body.gamertag, 24);

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { firebaseUid: decoded.uid },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
  });

  if (user?.isBanned) {
    return jsonError("Account is banned.", 403, "banned");
  }

  if (user && user.firebaseUid && user.firebaseUid !== decoded.uid) {
    return jsonError(
      "Account exists with a different sign-in method.",
      409,
      "account_conflict"
    );
  }

  if (!user) {
    let needsGamertag = false;
    let gamertag = requestedGamertag;
    if (!gamertag) {
      gamertag = `user-${decoded.uid.slice(0, 8)}`;
      needsGamertag = true;
    }

    const uniqueGamertag = await generateUniqueGamertag(gamertag);
    if (requestedGamertag && uniqueGamertag !== requestedGamertag) {
      return jsonError(
        "That gamertag is already in use.",
        409,
        "gamertag_taken"
      );
    }

    const passwordHash = await hashPassword(
      randomBytes(32).toString("hex")
    );

    user = await prisma.user.create({
      data: {
        email,
        gamertag: uniqueGamertag,
        passwordHash,
        firebaseUid: decoded.uid,
        needsGamertag,
      },
    });
  } else {
    if (!user.firebaseUid) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { firebaseUid: decoded.uid },
      });
    }

    if (requestedGamertag && (user.needsGamertag || !user.gamertag)) {
      const conflict = await prisma.user.findFirst({
        where: {
          gamertag: { equals: requestedGamertag, mode: "insensitive" },
          NOT: { id: user.id },
        },
      });
      if (conflict) {
        return jsonError(
          "That gamertag is already in use.",
          409,
          "gamertag_taken"
        );
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: { gamertag: requestedGamertag, needsGamertag: false },
      });
    }
  }

  const session = createSessionToken(user.id);
  if (!session) {
    return jsonError("Auth secret missing.", 500, "server_error");
  }

  const redirectTo =
    !user.gamertag || user.needsGamertag
      ? "/settings/profile?needsGamertag=1"
      : "/browse";

  const response = NextResponse.json({
    ok: true,
    redirectTo,
    needsGamertag: user.needsGamertag,
  });
  response.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(session.expiresAt),
  });
  return response;
}
