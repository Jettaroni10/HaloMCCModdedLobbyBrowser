import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";
import { normalizeHandleText, normalizeText } from "@/lib/validation";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json") ? await request.json() : null;
  const formData = body ? null : await request.formData();

  const handle = normalizeHandleText(
    body?.handle ?? formData?.get("handle"),
    32
  );
  const displayName = normalizeText(
    body?.displayName ?? formData?.get("displayName"),
    48
  );
  const emailRaw = body?.email ?? formData?.get("email");
  const email =
    typeof emailRaw === "string" && emailRaw.trim().length > 0
      ? emailRaw.toLowerCase().trim()
      : null;
  const steamName = normalizeHandleText(
    body?.steamName ?? formData?.get("steamName"),
    48
  );
  const xboxGamertag = normalizeHandleText(
    body?.xboxGamertag ?? formData?.get("xboxGamertag"),
    48
  );

  if (!handle || !displayName) {
    return NextResponse.json(
      { error: "Handle and display name are required." },
      { status: 400 }
    );
  }

  const existingHandle = await prisma.user.findUnique({
    where: { handle },
  });
  if (existingHandle) {
    return NextResponse.json(
      { error: "That handle is already in use." },
      { status: 409 }
    );
  }

  if (email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json(
        { error: "That email is already in use." },
        { status: 409 }
      );
    }
  }

  const user = await prisma.user.create({
    data: {
      email,
      handle,
      displayName,
      steamName: steamName || null,
      xboxGamertag: xboxGamertag || null,
    },
  });

  const session = createSessionToken(user.id);
  if (!session) {
    return NextResponse.json(
      { error: "Auth secret missing." },
      { status: 500 }
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
