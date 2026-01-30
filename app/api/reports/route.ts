import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeText, parseEnum } from "@/lib/validation";

const TARGET_TYPES = ["USER", "LOBBY", "REQUEST"] as const;
const CATEGORIES = ["SPAM", "HARASSMENT", "IMPERSONATION", "OTHER"] as const;

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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }

  const body = await readBody(request);
  const targetType = parseEnum(body.targetType, TARGET_TYPES);
  const targetId = normalizeText(body.targetId, 64);
  const category = parseEnum(body.category, CATEGORIES);
  const details = normalizeText(body.details, 1000);

  if (!targetType || !targetId || !category || !details) {
    return NextResponse.json(
      { error: "Invalid report payload." },
      { status: 400 }
    );
  }

  const report = await prisma.report.create({
    data: {
      reporterUserId: user.id,
      targetType,
      targetId,
      category,
      details,
    },
  });

  return NextResponse.json(report, { status: 201 });
}

