import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";
import { normalizeHandleText } from "@/lib/validation";
import { verifyPassword } from "@/lib/password";
import { absoluteUrl } from "@/lib/url";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json") ? await request.json() : null;
  const formData = body ? null : await request.formData();
  const isJson = contentType.includes("application/json");

  const handle = normalizeHandleText(
    body?.handle ?? formData?.get("handle"),
    32
  );
  const emailRaw = body?.email ?? formData?.get("email");
  const email =
    typeof emailRaw === "string" && emailRaw.trim().length > 0
      ? emailRaw.toLowerCase().trim()
      : null;
  const password =
    typeof (body?.password ?? formData?.get("password")) === "string"
      ? String(body?.password ?? formData?.get("password"))
      : "";

  if ((!handle && !email) || !password) {
    if (isJson) {
      return NextResponse.json(
        { error: "Handle/email and password are required." },
        { status: 400 }
      );
    }
    return NextResponse.redirect(
      absoluteUrl(request, "/login?error=missing_fields")
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        handle ? { handle } : undefined,
        email ? { email } : undefined,
      ].filter(Boolean) as { handle?: string; email?: string }[],
    },
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

  const response = NextResponse.redirect(absoluteUrl(request, "/browse"));
  response.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(session.expiresAt),
  });
  return response;
}

