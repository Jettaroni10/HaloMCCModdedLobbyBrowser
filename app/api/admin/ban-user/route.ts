import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { normalizeText } from "@/lib/validation";

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await readBody(request);
  const userId = normalizeText(body.userId, 64);

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true },
  });

  const isJson = (request.headers.get("content-type") ?? "").includes(
    "application/json"
  );
  if (isJson) {
    return NextResponse.json(updated);
  }
  return NextResponse.redirect(new URL("/admin", request.url));
}
