import { getCurrentUser } from "@/lib/auth";
import { hostEvents } from "@/lib/host-events";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.isBanned) {
    return new Response("Unauthorized", { status: 401 });
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

      const handleRequestCreated = (payload: {
        hostUserId: string;
        requesterGamertag: string;
        requesterNametagColor?: string | null;
        request: {
          id: string;
          requesterHandleText: string;
          lobby: { id: string };
        } & Record<string, unknown>;
      }) => {
        if (payload.hostUserId !== user.id) return;
        const requestData = {
          ...payload.request,
          requestId: payload.request.id,
          lobbyId: payload.request.lobby.id,
          requesterGamertag: payload.requesterGamertag,
          requesterNametagColor: payload.requesterNametagColor ?? null,
          requesterSrLevel: payload.requesterSrLevel ?? null,
          requesterHandleText: payload.request.requesterHandleText,
        };
        send("request_created", requestData);
      };

      const handleLobbyExpired = (payload: {
        hostUserId: string;
        lobby: unknown;
      }) => {
        if (payload.hostUserId !== user.id) return;
        send("lobby_expired", payload.lobby);
      };

      const handleRequestDecided = (payload: {
        hostUserId: string;
        request: {
          id: string;
          status: "ACCEPTED" | "DECLINED";
          decidedByUserId: string | null;
          lobby: { id: string; title: string };
        };
      }) => {
        if (payload.hostUserId !== user.id) return;
        send("request_decided", payload.request);
      };

      hostEvents.on("request_created", handleRequestCreated);
      hostEvents.on("request_decided", handleRequestDecided);
      hostEvents.on("lobby_expired", handleLobbyExpired);

      const ping = setInterval(() => {
        safeEnqueue(`event: ping\ndata: ${Date.now()}\n\n`);
      }, 15000);

      return () => {
        closed = true;
        clearInterval(ping);
        hostEvents.off("request_created", handleRequestCreated);
        hostEvents.off("request_decided", handleRequestDecided);
        hostEvents.off("lobby_expired", handleLobbyExpired);
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

