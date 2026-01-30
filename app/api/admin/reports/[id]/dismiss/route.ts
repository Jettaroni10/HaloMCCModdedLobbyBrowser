import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const updated = await prisma.report.update({
    where: { id: params.id },
    data: {
      status: "DISMISSED",
      resolvedAt: new Date(),
      resolvedByUserId: user.id,
    },
  });

  const isJson = (request.headers.get("content-type") ?? "").includes(
    "application/json"
  );
  if (isJson) {
    return NextResponse.json(updated);
  }
  return NextResponse.redirect(new URL("/admin", request.url));
}
