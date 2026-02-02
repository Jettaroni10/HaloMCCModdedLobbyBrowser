import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validateLobbyImageMeta } from "@/lib/lobby-images";
import { buildUserImagePath, getSignedUserUploadUrl } from "@/lib/user-images";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }
  if (!user.gamertag || user.needsGamertag) {
    return NextResponse.json(
      { error: "Gamertag required." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { contentType?: string; size?: number; ext?: string }
    | null;
  const error = validateLobbyImageMeta({
    contentType: body?.contentType,
    size: body?.size,
    ext: body?.ext,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const ext = body?.ext?.toLowerCase() || "webp";
  const objectPath = buildUserImagePath(user.id, ext);
  const uploadUrl = await getSignedUserUploadUrl({
    objectPath,
    contentType: body?.contentType ?? "image/webp",
  });

  return NextResponse.json({ uploadUrl, objectPath });
}
