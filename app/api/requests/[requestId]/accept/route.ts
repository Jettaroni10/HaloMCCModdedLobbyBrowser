import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function buildInviteChecklist(request: {
  requesterPlatform: string;
  requesterHandleText: string;
  confirmedSubscribed: boolean;
  confirmedEacOff: boolean;
  lobby: {
    isModded: boolean;
    workshopCollectionUrl: string | null;
    workshopItemUrls: string[];
    requiresEacOff: boolean;
  };
}) {
  const inviteMessage = `Invite sent to ${request.requesterHandleText}. Please join when ready.`;
  const steps = [
    {
      id: "copy-handle",
      label: "Copy requester handle",
      copyText: request.requesterHandleText,
    },
    {
      id: "copy-message",
      label: "Copy invite message template",
      copyText: inviteMessage,
    },
    {
      id: "open-overlay",
      label: "Open Steam overlay or Xbox app",
    },
    {
      id: "send-invite",
      label: "Send invite manually",
    },
  ];

  const payload: Record<string, unknown> = {
    requester: {
      platform: request.requesterPlatform,
      handleText: request.requesterHandleText,
    },
    steps,
    copyStrings: {
      requesterHandle: request.requesterHandleText,
      inviteMessage,
      steamInstructions:
        "Open Steam overlay (Shift+Tab) and invite the player from Friends.",
      xboxInstructions:
        "Open the Xbox app and send an invite from your friends list.",
    },
  };

  if (request.lobby.isModded) {
    payload.modded = {
      workshopCollectionUrl: request.lobby.workshopCollectionUrl,
      workshopItemUrls: request.lobby.workshopItemUrls,
      requiresEacOff: request.lobby.requiresEacOff,
      requesterConfirmedSubscribed: request.confirmedSubscribed,
      requesterConfirmedEacOff: request.confirmedEacOff,
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

  const joinRequest = await prisma.joinRequest.findUnique({
    where: { id: params.requestId },
    include: {
      lobby: true,
    },
  });

  if (!joinRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (joinRequest.lobby.hostUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const updated = await prisma.joinRequest.update({
    where: { id: params.requestId },
    data: {
      status: "ACCEPTED",
      decidedAt: new Date(),
      decidedByUserId: user.id,
    },
    include: {
      lobby: true,
    },
  });

  const checklist = buildInviteChecklist({
    requesterPlatform: updated.requesterPlatform,
    requesterHandleText: updated.requesterHandleText,
    confirmedSubscribed: updated.confirmedSubscribed,
    confirmedEacOff: updated.confirmedEacOff,
    lobby: {
      isModded: updated.lobby.isModded,
      workshopCollectionUrl: updated.lobby.workshopCollectionUrl,
      workshopItemUrls: updated.lobby.workshopItemUrls,
      requiresEacOff: updated.lobby.requiresEacOff,
    },
  });

  return NextResponse.json(checklist);
}
