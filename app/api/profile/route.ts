import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeHandleText, normalizeText } from "@/lib/validation";

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

  const displayName = normalizeText(
    body?.displayName ?? formData?.get("displayName"),
    48
  );
  const steamName = normalizeHandleText(
    body?.steamName ?? formData?.get("steamName"),
    48
  );
  const xboxGamertag = normalizeHandleText(
    body?.xboxGamertag ?? formData?.get("xboxGamertag"),
    48
  );

  if (!displayName) {
    return NextResponse.json(
      { error: "Display name is required." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName,
      steamName: steamName || null,
      xboxGamertag: xboxGamertag || null,
    },
  });

  const isJson = (request.headers.get("content-type") ?? "").includes(
    "application/json"
  );
  if (isJson) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(new URL("/settings/profile", request.url));
}
