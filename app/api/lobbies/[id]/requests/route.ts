import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  normalizeHandleText,
  normalizeText,
  parseBoolean,
} from "@/lib/validation";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";
import { emitRequestCreated } from "@/lib/host-events";
import { emitLobbyRequestCreated } from "@/lib/lobby-events";
import { addXp, hasXpEvent } from "@/lib/xp";
import { logPerf } from "@/lib/perf";
import { absoluteUrl } from "@/lib/url";

const LIMITS = {
  note: 200,
};

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const perfStart = Date.now();
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (user.isBanned) {
      return NextResponse.json(
        { error: "Account is banned." },
        { status: 403 }
      );
    }

    const body = await readBody(request);
    const requesterHandleText = normalizeHandleText(
      body.requesterHandleText,
      48
    );
    const note = normalizeText(body.note, LIMITS.note);
    const confirmedSubscribed = parseBoolean(body.confirmedSubscribed) ?? false;

    if (!requesterHandleText) {
      return NextResponse.json(
        { error: "Steam name is required." },
        { status: 400 }
      );
    }

    const lobby = await prisma.lobby.findUnique({
      where: { id: params.id },
    });
    if (!lobby || !lobby.isActive || lobby.expiresAt <= new Date()) {
      return NextResponse.json(
        { error: "Lobby not available." },
        { status: 404 }
      );
    }

    if (lobby.isModded) {
      const hasMods =
        Boolean(lobby.workshopCollectionUrl) ||
        lobby.workshopItemUrls.length > 0;
      if (hasMods && !confirmedSubscribed) {
        return NextResponse.json(
          { error: "Please confirm mod subscription before requesting." },
          { status: 400 }
        );
      }
    }

    const blocked = await prisma.block.findUnique({
      where: {
        blockerUserId_blockedUserId: {
          blockerUserId: lobby.hostUserId,
          blockedUserId: user.id,
        },
      },
    });
    if (blocked) {
      return NextResponse.json({ error: "Blocked by host." }, { status: 403 });
    }

    const perMinuteLimited = await isRateLimited(
      user.id,
      "join_request",
      5,
      60 * 1000
    );
    if (perMinuteLimited) {
      return NextResponse.json(
        {
          error: "You are sending requests too quickly. Try again in a minute.",
        },
        { status: 429 }
      );
    }

    const perHourLimited = await isRateLimited(
      user.id,
      "join_request",
      30,
      60 * 60 * 1000
    );
    if (perHourLimited) {
      return NextResponse.json(
        { error: "Hourly request limit reached. Try again later." },
        { status: 429 }
      );
    }

    const pendingCount = await prisma.joinRequest.count({
      where: { lobbyId: lobby.id, status: "PENDING" },
    });
    if (pendingCount >= 20) {
      return NextResponse.json(
        { error: "This lobby is full of pending requests. Try again later." },
        { status: 429 }
      );
    }

    const existing = await prisma.joinRequest.findFirst({
      where: {
        lobbyId: lobby.id,
        requesterUserId: user.id,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Request already exists." },
        { status: 409 }
      );
    }

    const joinRequest = await prisma.joinRequest.create({
      data: {
        lobbyId: lobby.id,
        requesterUserId: user.id,
        requesterPlatform: "STEAM",
        requesterHandleText,
        note: note || null,
        confirmedSubscribed,
      },
    });

    await recordRateLimitEvent(user.id, "join_request");

    const joinRequestXpMeta = { lobbyId: lobby.id };
    const alreadyAwarded = await hasXpEvent(
      user.id,
      "JOIN_REQUEST_CREATED",
      joinRequestXpMeta
    );
    if (!alreadyAwarded) {
      await addXp(user.id, 15, "JOIN_REQUEST_CREATED", joinRequestXpMeta);
    }

    emitRequestCreated({
      hostUserId: lobby.hostUserId,
      requesterDisplayName: user.displayName,
      requesterNametagColor: user.nametagColor,
      request: {
        id: joinRequest.id,
        requesterUserId: joinRequest.requesterUserId,
        requesterHandleText: joinRequest.requesterHandleText,
        note: joinRequest.note,
        confirmedSubscribed: joinRequest.confirmedSubscribed,
        status: "PENDING",
        createdAt: joinRequest.createdAt.toISOString(),
        lobby: {
          id: lobby.id,
          title: lobby.title,
          isModded: lobby.isModded,
        },
      },
    });

    emitLobbyRequestCreated({
      lobbyId: lobby.id,
      request: {
        id: joinRequest.id,
        requesterUserId: joinRequest.requesterUserId,
        requesterHandleText: joinRequest.requesterHandleText,
        requesterDisplayName: user.displayName,
        requesterNametagColor: user.nametagColor,
        createdAt: joinRequest.createdAt.toISOString(),
      },
    });

    const isJson = (request.headers.get("content-type") ?? "").includes(
      "application/json"
    );
    if (isJson) {
      return NextResponse.json(joinRequest, { status: 201 });
    }
    return NextResponse.redirect(absoluteUrl(request, `/lobbies/${lobby.id}`));
  } finally {
    logPerf("join request create", perfStart, { lobbyId: params.id });
  }
}

