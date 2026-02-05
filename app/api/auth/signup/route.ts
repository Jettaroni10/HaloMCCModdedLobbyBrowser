import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";
import { normalizeHandleText } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { DEFAULT_NAMETAG_COLOR } from "@/lib/reach-colors";
import { absoluteUrl } from "@/lib/url";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json") ? await request.json() : null;
  const formData = body ? null : await request.formData();
  const isJson = contentType.includes("application/json");

  // Legacy email/password signup is disabled after Firebase migration.
  const legacySignupDisabled = true;
  if (legacySignupDisabled) {
    if (isJson) {
      return NextResponse.json(
        {
          error:
            "Legacy sign-up is disabled. Please use Firebase sign-up instead.",
        },
        { status: 410 }
      );
    }
    return NextResponse.redirect(
      absoluteUrl(request, "/signup?error=legacy_signup_disabled")
    );
  }

  const gamertag = normalizeHandleText(
    body?.gamertag ?? formData?.get("gamertag"),
    32
  );
  const password =
    typeof (body?.password ?? formData?.get("password")) === "string"
      ? String(body?.password ?? formData?.get("password"))
      : "";
  const emailRaw = body?.email ?? formData?.get("email");
  const email =
    typeof emailRaw === "string" && emailRaw.trim().length > 0
      ? emailRaw.toLowerCase().trim()
      : "";

  if (!email || !password || !gamertag) {
    if (isJson) {
      return NextResponse.json(
        { error: "Email, password, and gamertag are required." },
        { status: 400 }
      );
    }
    return NextResponse.redirect(
      absoluteUrl(request, "/signup?error=missing_fields")
    );
  }

  const existingGamertag = await prisma.user.findFirst({
    where: { gamertag: { equals: gamertag, mode: "insensitive" } },
  });
  if (existingGamertag) {
    if (isJson) {
      return NextResponse.json(
        { error: "That gamertag is already in use." },
        { status: 409 }
      );
    }
    return NextResponse.redirect(
      absoluteUrl(request, "/signup?error=gamertag_taken")
    );
  }

  const existingEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existingEmail) {
    if (isJson) {
      return NextResponse.json(
        { error: "That email is already in use." },
        { status: 409 }
      );
    }
    return NextResponse.redirect(
      absoluteUrl(request, "/signup?error=email_taken")
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      gamertag,
      nametagColor: DEFAULT_NAMETAG_COLOR,
      passwordHash,
      needsGamertag: false,
    },
  });

  const session = createSessionToken(user.id);
  if (!session) {
    if (isJson) {
      return NextResponse.json(
        { error: "Auth secret missing." },
        { status: 500 }
      );
    }
    return NextResponse.redirect(absoluteUrl(request, "/signup?error=server"));
  }

  const response = NextResponse.redirect(absoluteUrl(request, "/browse"));
  response.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(session.expiresAt),
  });

  return response;
}

