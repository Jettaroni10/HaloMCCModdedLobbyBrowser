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
  dmId?: string;
  browseTelemetry?: boolean;
}) {
  const rest = getRestClient();
  const capability: Record<string, ("publish" | "subscribe")[]> = {
    // Per-user notifications channel (subscribe-only).
    [`user:${params.clientId}:notifications`]: ["subscribe"],
  };

  if (params.lobbyId) {
    // Main lobby channel is subscribe-only to prevent client spoofing.
    capability[`lobby:${params.lobbyId}`] = ["subscribe"];
    // Typing channel is isolated and allows client publish/subscribe.
    capability[`lobby:${params.lobbyId}:typing`] = ["publish", "subscribe"];
  }

  if (params.dmId) {
    capability[`dm:${params.dmId}`] = ["subscribe"];
    capability[`dm:${params.dmId}:typing`] = ["publish", "subscribe"];
  }

  if (params.browseTelemetry) {
    capability["lobbies:telemetry"] = ["subscribe"];
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

export async function publishBrowseTelemetryEvent(params: {
  event: string;
  payload: unknown;
}) {
  try {
    const rest = getRestClient();
    await rest.channels
      .get("lobbies:telemetry")
      .publish(params.event, params.payload);
  } catch (error) {
    console.error("Ably browse telemetry publish failed", {
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
      .get(`user:${params.hostUserId}:notifications`)
      .publish(params.event, params.payload);
  } catch (error) {
    console.error("Ably host publish failed", {
      hostUserId: params.hostUserId,
      event: params.event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function publishDmEvent(params: {
  conversationId: string;
  event: string;
  payload: unknown;
}) {
  try {
    const rest = getRestClient();
    await rest.channels
      .get(`dm:${params.conversationId}`)
      .publish(params.event, params.payload);
  } catch (error) {
    console.error("Ably DM publish failed", {
      conversationId: params.conversationId,
      event: params.event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
