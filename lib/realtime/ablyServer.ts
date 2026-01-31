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
      [`lobby:${params.lobbyId}`]: ["publish", "subscribe"],
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
  } catch {
    // Realtime is best-effort; DB write already succeeded.
  }
}
