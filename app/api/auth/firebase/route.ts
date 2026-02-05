import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isValidGamertag, normalizeText } from "@/lib/validation";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type FirebaseAuthPayload = {
  idToken?: string;
  gamertag?: string;
};

function jsonError(
  error: string,
  status = 400,
  message?: string,
  code?: string
) {
  return NextResponse.json({ error, message, code }, { status });
}

function logFailure(stage: string, details?: Record<string, unknown>) {
  const payload = details ? { stage, ...details } : { stage };
  console.warn("AUTH_FIREBASE_FAIL", payload);
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
    logFailure("invalid_json");
    return jsonError("invalid_request_payload", 400);
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) {
    logFailure("missing_id_token");
    return jsonError("missing_id_token", 400);
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      typeof error === "object" &&
      error &&
      "code" in error &&
      typeof (error as { code?: string }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    logFailure("verify_failed", { message, code });
    return jsonError("verify_failed", 401, message, code);
  }

  const email = decoded.email?.toLowerCase().trim();
  if (!email) {
    logFailure("missing_email");
    return jsonError("missing_email", 400, "Email not available for this account.");
  }

  const requestedGamertag = normalizeText(body.gamertag, 24);
  const signInProvider =
    typeof decoded.firebase?.sign_in_provider === "string"
      ? decoded.firebase.sign_in_provider
      : "";

  if (
    signInProvider &&
    !["password", "google.com"].includes(signInProvider)
  ) {
    logFailure("provider_rejected", { signInProvider });
    return jsonError(
      "provider_rejected",
      400,
      "Unsupported sign-in provider.",
      "provider"
    );
  }

  if (requestedGamertag && !isValidGamertag(requestedGamertag)) {
    logFailure("gamertag_invalid");
    return jsonError(
      "gamertag_invalid",
      400,
      "Gamertag must be 3-24 characters and use letters, numbers, spaces, or underscore."
    );
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { firebaseUid: decoded.uid },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
  });

  if (user?.isBanned) {
    logFailure("banned");
    return jsonError("banned", 403, "Account is banned.");
  }

  if (user && user.firebaseUid && user.firebaseUid !== decoded.uid) {
    logFailure("account_conflict");
    return jsonError(
      "account_conflict",
      409,
      "Account exists with a different sign-in method."
    );
  }

  if (!user) {
    if (signInProvider === "password" && !requestedGamertag) {
      logFailure("gamertag_required");
      return jsonError(
        "gamertag_required",
        400,
        "Gamertag is required for email sign up."
      );
    }
    let needsGamertag = false;
    let gamertag = requestedGamertag;
    if (!gamertag) {
      gamertag = `user-${decoded.uid.slice(0, 8)}`;
      needsGamertag = true;
    }

    const uniqueGamertag = await generateUniqueGamertag(gamertag);
    if (requestedGamertag && uniqueGamertag !== requestedGamertag) {
      logFailure("gamertag_taken");
      return jsonError(
        "gamertag_taken",
        409,
        "That gamertag is already in use."
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
        logFailure("gamertag_taken");
        return jsonError(
          "gamertag_taken",
          409,
          "That gamertag is already in use."
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
    logFailure("auth_secret_missing");
    return jsonError("auth_secret_missing", 500, "Auth secret missing.");
  }

  const redirectTo =
    !user.gamertag || user.needsGamertag ? "/complete-profile" : "/browse";

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
