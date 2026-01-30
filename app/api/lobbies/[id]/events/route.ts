import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lobbyEvents } from "@/lib/lobby-events";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.isBanned) {
    return new Response("Unauthorized", { status: 401 });
  }

  const lobby = await prisma.lobby.findUnique({
    where: { id: params.id },
    select: { id: true, hostUserId: true },
  });
  if (!lobby) {
    return new Response("Lobby not found", { status: 404 });
  }

  const isHost = lobby.hostUserId === user.id;
  const member = await prisma.lobbyMember.findUnique({
    where: { lobbyId_userId: { lobbyId: lobby.id, userId: user.id } },
  });
  const acceptedRequest = await prisma.joinRequest.findFirst({
    where: {
      lobbyId: lobby.id,
      requesterUserId: user.id,
      status: "ACCEPTED",
    },
  });

  if (!isHost && !member && !acceptedRequest) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      const send = (event: string, data: unknown) => {
        safeEnqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const handleMessageCreated = (payload: {
        lobbyId: string;
        message: unknown;
      }) => {
        if (payload.lobbyId !== lobby.id) return;
        send("message_created", payload.message);
      };

      const handleRosterUpdated = (payload: { lobbyId: string }) => {
        if (payload.lobbyId !== lobby.id) return;
        send("roster_updated", payload);
      };

      const handleRequestCreated = (payload: {
        lobbyId: string;
        request: unknown;
      }) => {
        if (!isHost) return;
        if (payload.lobbyId !== lobby.id) return;
        send("request_created", payload.request);
      };

      lobbyEvents.on("message_created", handleMessageCreated);
      lobbyEvents.on("roster_updated", handleRosterUpdated);
      lobbyEvents.on("request_created", handleRequestCreated);

      const ping = setInterval(() => {
        safeEnqueue(`event: ping\ndata: ${Date.now()}\n\n`);
      }, 15000);

      return () => {
        closed = true;
        clearInterval(ping);
        lobbyEvents.off("message_created", handleMessageCreated);
        lobbyEvents.off("roster_updated", handleRosterUpdated);
        lobbyEvents.off("request_created", handleRequestCreated);
      };
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
