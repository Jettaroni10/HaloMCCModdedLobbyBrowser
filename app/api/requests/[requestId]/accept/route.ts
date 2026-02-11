import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { addXp } from "@/lib/xp";
import { emitLobbyRosterUpdated } from "@/lib/lobby-events";
import { emitRequestDecided } from "@/lib/host-events";

function buildInviteChecklist(request: {
  requesterHandleText: string;
  requesterNametagColor?: string | null;
  confirmedSubscribed: boolean;
  lobby: {
    isModded: boolean;
    workshopCollectionUrl: string | null;
    workshopItemUrls: string[];
  };
}) {
  const inviteMessage = `Invite sent to ${request.requesterHandleText}. Please join when ready.`;
  const steps = [
    {
      id: "copy-gamertag",
      label: "Copy gamertag",
      copyText: request.requesterHandleText,
    },
    {
      id: "copy-message",
      label: "Copy invite message template",
      copyText: inviteMessage,
    },
    {
      id: "open-overlay",
      label: "Open invite overlay or roster",
    },
    {
      id: "send-invite",
      label: "Send invite using the gamertag",
    },
  ];

  const payload: Record<string, unknown> = {
    requester: {
      gamertag: request.requesterHandleText,
      nametagColor: request.requesterNametagColor ?? null,
    },
    steps,
    copyStrings: {
      requesterGamertag: request.requesterHandleText,
      inviteMessage,
      steamInstructions:
        "Invite the player using their gamertag via Steam overlay or in-game roster.",
    },
  };

  if (request.lobby.isModded) {
    payload.modded = {
      workshopCollectionUrl: request.lobby.workshopCollectionUrl,
      workshopItemUrls: request.lobby.workshopItemUrls,
      requesterConfirmedSubscribed: request.confirmedSubscribed,
    };
  }

  return payload;
}

export async function POST(
  _request: Request,
  { params }: { params: { requestId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Account is banned." }, { status: 403 });
  }
  if (!user.gamertag || user.needsGamertag) {
    return NextResponse.json(
      { error: "Gamertag required before sending invites." },
      { status: 403 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const joinRequest = await tx.joinRequest.findUnique({
      where: { id: params.requestId },
      include: {
        lobby: true,
        requester: { select: { nametagColor: true } },
      },
    });

    if (!joinRequest) {
      return { error: "NOT_FOUND" as const };
    }
    if (joinRequest.lobby.hostUserId !== user.id) {
      return { error: "FORBIDDEN" as const };
    }
    if (joinRequest.status !== "PENDING") {
      return { error: "ALREADY_DECIDED" as const };
    }

    const slotsTotal = joinRequest.lobby.slotsTotal ?? 16;
    const members = await tx.lobbyMember.findMany({
      where: { lobbyId: joinRequest.lobbyId },
      select: { slotNumber: true },
    });
    const taken = new Set(members.map((member) => member.slotNumber));
    let slotNumber = 0;
    for (let i = 1; i <= slotsTotal; i += 1) {
      if (!taken.has(i)) {
        slotNumber = i;
        break;
      }
    }
    if (!slotNumber) {
      return { error: "FULL" as const };
    }

    const updated = await tx.joinRequest.update({
      where: { id: params.requestId },
      data: {
        status: "ACCEPTED",
        decidedAt: new Date(),
        decidedByUserId: user.id,
      },
      include: {
        lobby: true,
        requester: { select: { nametagColor: true } },
      },
    });

    await tx.lobbyMember.create({
      data: {
        lobbyId: joinRequest.lobbyId,
        userId: joinRequest.requesterUserId,
        slotNumber,
      },
    });

    const conversation = await tx.conversation.findFirst({
      where: { lobbyId: joinRequest.lobbyId, type: "LOBBY" },
      select: { id: true },
    });
    if (conversation) {
      await tx.conversationParticipant.createMany({
        data: [
          {
            conversationId: conversation.id,
            userId: joinRequest.requesterUserId,
          },
        ],
        skipDuplicates: true,
      });
    }

    return { updated };
  });

  if ("error" in result) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (result.error === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (result.error === "ALREADY_DECIDED") {
      return NextResponse.json(
        { error: "Request already processed." },
        { status: 409 }
      );
    }
    if (result.error === "FULL") {
      return NextResponse.json({ error: "Lobby full." }, { status: 409 });
    }
  }

  const updated = result.updated;
  if (!updated) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  await addXp(updated.requesterUserId, 40, "JOIN_REQUEST_ACCEPTED", {
    lobbyId: updated.lobbyId,
    requestId: updated.id,
    role: "requester",
  });
  await addXp(updated.lobby.hostUserId, 20, "JOIN_REQUEST_ACCEPTED", {
    lobbyId: updated.lobbyId,
    requestId: updated.id,
    role: "host",
  });

  emitLobbyRosterUpdated({ lobbyId: updated.lobbyId });
  emitRequestDecided({
    hostUserId: updated.lobby.hostUserId,
    request: {
      id: updated.id,
      status: "ACCEPTED",
      decidedByUserId: updated.decidedByUserId ?? null,
      lobby: {
        id: updated.lobbyId,
        title: updated.lobby.title,
      },
    },
  });

  const checklist = buildInviteChecklist({
    requesterHandleText: updated.requesterHandleText,
    requesterNametagColor: updated.requester.nametagColor,
    confirmedSubscribed: updated.confirmedSubscribed,
    lobby: {
      isModded: updated.lobby.isModded,
      workshopCollectionUrl: updated.lobby.workshopCollectionUrl,
      workshopItemUrls: updated.lobby.workshopItemUrls,
    },
  });

  return NextResponse.json(checklist);
}

