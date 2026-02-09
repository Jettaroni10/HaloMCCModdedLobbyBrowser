# Safe MCC Telemetry Mod Architecture

## Goal
Provide offline custom-game telemetry to `pc-app` using only supported mod/plugin APIs.

## Non-goals
- No direct memory reads.
- No process injection/hooking bypass work.
- No anti-cheat bypass behavior.

## Contract
The desktop app expects a JSON envelope at `%APPDATA%\\MCC\\customs_state.json`:

```json
{
  "version": "1.0",
  "data": {
    "isCustomGame": true,
    "mapName": "mp_convoy",
    "gameMode": "Team Deathmatch",
    "playerCount": 8,
    "maxPlayers": 16,
    "hostName": "Player1",
    "mods": ["mod1", "mod2"],
    "timestamp": "2026-02-09T20:15:00Z",
    "sessionID": "abc123def456"
  }
}
```

Schema file: `contracts/telemetry.schema.json`.

## Runtime Safety Model
- `offlineOnly`: writer disabled unless game context is offline/custom.
- `enabled`: global on/off switch.
- `updateIntervalMs`: telemetry write cadence.
- Fail-closed behavior: invalid payloads are skipped.

## Writer Behavior
1. Pull game/session data from supported API surface.
2. Validate data and sanitize ranges.
3. Write a complete JSON snapshot atomically or `POST` to local receiver.
4. Repeat on fixed interval while enabled.

## Local Receiver (optional)
- Endpoint: `POST http://127.0.0.1:4760/telemetry`
- Health: `GET http://127.0.0.1:4760/health`
- Server validates the payload and writes `%APPDATA%\\MCC\\customs_state.json`.
- Start with: `npm run telemetry:receiver` (repo root) or `npm run telemetry:receiver --prefix pc-app`.

## Writer Settings (example)

```json
{
  "enabled": true,
  "outputPath": "%APPDATA%\\MCC\\customs_state.json",
  "updateInterval": 2000,
  "offlineOnly": true,
  "debugMode": false
}
```

## Desktop App Integration Notes
- The app supports both `version+data` envelope and legacy flat JSON.
- `sessionID` is tracked; a new session closes the previous active lobby and starts a new one.
- If telemetry file updates stop for ~15 seconds, the lobby is marked inactive.
