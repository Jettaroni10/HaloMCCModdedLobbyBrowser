import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, getSessionCookieName } from "@/lib/auth";
import { normalizeHandleText } from "@/lib/validation";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json") ? await request.json() : null;
  const formData = body ? null : await request.formData();

  const handle = normalizeHandleText(
    body?.handle ?? formData?.get("handle"),
    32
  );
  const emailRaw = body?.email ?? formData?.get("email");
  const email =
    typeof emailRaw === "string" && emailRaw.trim().length > 0
      ? emailRaw.toLowerCase().trim()
      : null;

  if (!handle && !email) {
    return NextResponse.json(
      { error: "Handle or email is required." },
      { status: 400 }
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
    return NextResponse.json(
      { error: "No matching account found." },
      { status: 404 }
    );
  }
  if (user.isBanned) {
    return NextResponse.json(
      { error: "Account is banned." },
      { status: 403 }
    );
  }

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
