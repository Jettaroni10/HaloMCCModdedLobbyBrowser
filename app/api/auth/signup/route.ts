import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";
import { normalizeHandleText, normalizeText } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { DEFAULT_NAMETAG_COLOR } from "@/lib/reach-colors";

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
  const displayName = normalizeText(
    body?.displayName ?? formData?.get("displayName"),
    48
  );
  const password =
    typeof (body?.password ?? formData?.get("password")) === "string"
      ? String(body?.password ?? formData?.get("password"))
      : "";
  const emailRaw = body?.email ?? formData?.get("email");
  const email =
    typeof emailRaw === "string" && emailRaw.trim().length > 0
      ? emailRaw.toLowerCase().trim()
      : null;
  const steamName = normalizeHandleText(
    body?.steamName ?? formData?.get("steamName"),
    48
  );

  if (!handle || !displayName || !password) {
    if (isJson) {
      return NextResponse.json(
        { error: "Handle, display name, and password are required." },
        { status: 400 }
      );
    }
    return NextResponse.redirect(
      new URL("/signup?error=missing_fields", request.url)
    );
  }

  const existingHandle = await prisma.user.findUnique({
    where: { handle },
  });
  if (existingHandle) {
    if (isJson) {
      return NextResponse.json(
        { error: "That handle is already in use." },
        { status: 409 }
      );
    }
    return NextResponse.redirect(
      new URL("/signup?error=handle_taken", request.url)
    );
  }

  if (email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      if (isJson) {
        return NextResponse.json(
          { error: "That email is already in use." },
          { status: 409 }
        );
      }
      return NextResponse.redirect(
        new URL("/signup?error=email_taken", request.url)
      );
    }
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      handle,
      displayName,
      nametagColor: DEFAULT_NAMETAG_COLOR,
      passwordHash,
      steamName: steamName || null,
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
    return NextResponse.redirect(
      new URL("/signup?error=server", request.url)
    );
  }

  const response = NextResponse.redirect(new URL("/browse", request.url));
  response.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(session.expiresAt),
  });

  return response;
}

