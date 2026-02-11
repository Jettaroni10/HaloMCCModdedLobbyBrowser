import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { absoluteUrl } from "@/lib/url";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json") ? await request.json() : null;
  const formData = body ? null : await request.formData();
  const isJson = contentType.includes("application/json");

  const emailRaw = body?.email ?? formData?.get("email");
  const email =
    typeof emailRaw === "string" && emailRaw.trim().length > 0
      ? emailRaw.toLowerCase().trim()
      : "";
  const password =
    typeof (body?.password ?? formData?.get("password")) === "string"
      ? String(body?.password ?? formData?.get("password"))
      : "";

  if (!email || !password) {
    if (isJson) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }
    return NextResponse.redirect(
      absoluteUrl(request, "/login?error=missing_fields")
    );
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!user) {
    if (isJson) {
      return NextResponse.json(
        { error: "No matching account found." },
        { status: 404 }
      );
    }
    return NextResponse.redirect(
      absoluteUrl(request, "/login?error=not_found")
    );
  }
  if (user.isBanned) {
    if (isJson) {
      return NextResponse.json(
        { error: "Account is banned." },
        { status: 403 }
      );
    }
    return NextResponse.redirect(absoluteUrl(request, "/login?error=banned"));
  }

  if (user.authStatus && user.authStatus !== "ACTIVE") {
    const message =
      user.authStatus === "LEGACY"
        ? "Your account was created before our login upgrade. Please re-register to continue."
        : "Account is disabled.";
    if (isJson) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.redirect(
      absoluteUrl(
        request,
        `/login?error=${user.authStatus.toLowerCase()}`
      )
    );
  }

  if (!user.passwordHash) {
    if (isJson) {
      return NextResponse.json(
        { error: "Password not set." },
        { status: 401 }
      );
    }
    return NextResponse.redirect(absoluteUrl(request, "/login?error=invalid"));
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    if (isJson) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }
    return NextResponse.redirect(absoluteUrl(request, "/login?error=invalid"));
  }

  const session = createSessionToken(user.id);
  if (!session) {
    if (isJson) {
      return NextResponse.json(
        { error: "Auth secret missing." },
        { status: 500 }
      );
    }
    return NextResponse.redirect(absoluteUrl(request, "/login?error=server"));
  }

  const redirectPath =
    !user.gamertag || user.needsGamertag ? "/complete-profile" : "/browse";
  const response = NextResponse.redirect(absoluteUrl(request, redirectPath));
  response.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(session.expiresAt),
  });
  return response;
}

