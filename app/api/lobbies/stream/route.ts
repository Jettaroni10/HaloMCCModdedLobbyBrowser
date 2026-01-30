export const runtime = "nodejs";

export async function GET() {
  let interval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: string) => {
        controller.enqueue(encoder.encode(payload));
      };

      send("event: ready\ndata: stream-open\n\n");

      interval = setInterval(() => {
        send(`event: ping\ndata: ${Date.now()}\n\n`);
      }, 15000);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
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
