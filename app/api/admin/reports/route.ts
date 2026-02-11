import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { id: true, gamertag: true } },
      resolvedBy: { select: { id: true, gamertag: true } },
    },
  });

  return NextResponse.json(reports);
}

