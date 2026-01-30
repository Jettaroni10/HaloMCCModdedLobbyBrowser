import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { id: true, handle: true, displayName: true } },
      resolvedBy: { select: { id: true, handle: true, displayName: true } },
    },
  });

  return NextResponse.json(reports);
}
