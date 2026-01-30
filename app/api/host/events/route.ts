import { getCurrentUser } from "@/lib/auth";
import { hostEvents } from "@/lib/host-events";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.isBanned) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const handleRequestCreated = (payload: {
        hostUserId: string;
        request: unknown;
      }) => {
        if (payload.hostUserId !== user.id) return;
        send("request_created", payload.request);
      };

      const handleLobbyExpired = (payload: {
        hostUserId: string;
        lobby: unknown;
      }) => {
        if (payload.hostUserId !== user.id) return;
        send("lobby_expired", payload.lobby);
      };

      hostEvents.on("request_created", handleRequestCreated);
      hostEvents.on("lobby_expired", handleLobbyExpired);

      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      }, 15000);

      return () => {
        clearInterval(ping);
        hostEvents.off("request_created", handleRequestCreated);
        hostEvents.off("lobby_expired", handleLobbyExpired);
      };
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
