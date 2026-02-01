import Ably from "ably";

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

export async function createRealtimeTokenRequest(params: {
  clientId: string;
  lobbyId?: string;
}) {
  const rest = getRestClient();
  const capability: Record<string, ("publish" | "subscribe")[]> = {
    // Host channel is subscribe-only for the current user.
    [`host:${params.clientId}`]: ["subscribe"],
  };

  if (params.lobbyId) {
    // Main lobby channel is subscribe-only to prevent client spoofing.
    capability[`lobby:${params.lobbyId}`] = ["subscribe"];
    // Typing channel is isolated and allows client publish/subscribe.
    capability[`lobby:${params.lobbyId}:typing`] = ["publish", "subscribe"];
  }

  return rest.auth.createTokenRequest({
    clientId: params.clientId,
    capability,
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

export async function publishHostEvent(params: {
  hostUserId: string;
  event: string;
  payload: unknown;
}) {
  try {
    const rest = getRestClient();
    await rest.channels
      .get(`host:${params.hostUserId}`)
      .publish(params.event, params.payload);
  } catch (error) {
    console.error("Ably host publish failed", {
      hostUserId: params.hostUserId,
      event: params.event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
