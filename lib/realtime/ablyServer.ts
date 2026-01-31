import Ably from "ably/promises";

let restClient: Ably.Rest | null = null;

function getRestClient() {
  if (restClient) return restClient;
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    throw new Error("ABLY_API_KEY is missing.");
  }
  restClient = new Ably.Rest(apiKey);
  return restClient;
}

export async function createLobbyTokenRequest(params: {
  lobbyId: string;
  clientId: string;
}) {
  const rest = getRestClient();
  return rest.auth.createTokenRequest({
    clientId: params.clientId,
    capability: {
      // Main lobby channel is subscribe-only to prevent client spoofing.
      [`lobby:${params.lobbyId}`]: ["subscribe"],
      // Typing channel is isolated and allows client publish/subscribe.
      [`lobby:${params.lobbyId}:typing`]: ["publish", "subscribe"],
    },
  });
}

export async function publishLobbyEvent(params: {
  lobbyId: string;
  event: string;
  payload: unknown;
}) {
  try {
    const rest = getRestClient();
    await rest.channels
      .get(`lobby:${params.lobbyId}`)
      .publish(params.event, params.payload);
  } catch (error) {
    console.error("Ably publish failed", {
      lobbyId: params.lobbyId,
      event: params.event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
