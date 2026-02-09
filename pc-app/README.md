# Halo MCC Lobby Browser (PC)

Standalone Electron desktop app. Stores lobbies locally on the PC and includes a simulated session monitor to publish a lobby automatically.

## Run locally

1. Install deps:

```bash
cd pc-app
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Optional: run a local telemetry writer demo in a second terminal:

```bash
npm run telemetry:demo
```

4. Optional: run the local telemetry receiver (for future MCC mod/plugin writers):

```bash
npm run telemetry:receiver
```

## Notes

- Data is stored in the Electron user data directory as `halo-mcc-lobbies.json`.
- The monitor uses a simulated game state for now (hook it to real MCC telemetry later).
- Auto-population enriches map + mode info from `data/maps.json` and `data/modes.json`.
- Mod detection can scan common folders (best effort) from the UI.

## Telemetry file schema

Point the telemetry panel to a JSON file with fields like:

```json
{
  "version": "1.0",
  "data": {
    "isCustomGame": true,
    "mapName": "Valhalla",
    "gameMode": "Slayer",
    "playlist": "Custom",
    "hostName": "Host",
    "playerCount": 4,
    "maxPlayers": 16,
    "mods": ["mod_a", "mod_b"],
    "timestamp": "2026-02-09T20:15:00Z",
    "sessionID": "abc123def456"
  }
}
```

If the file stops updating for ~15 seconds, the lobby is treated as inactive.
The app also accepts legacy flat JSON without `version` and `data`.

Default telemetry path (Windows):

```
%APPDATA%\MCC\customs_state.json
```
- This folder is separate from the Next.js web app.
- Contract reference: `contracts/telemetry.schema.json`
- Architecture notes: `docs/SAFE_MOD_TELEMETRY_ARCHITECTURE.md`

## Receiver API

The receiver listens on `http://127.0.0.1:4760`.

- `GET /health`
- `POST /telemetry`

Example payload:

```json
{
  "version": "1.0",
  "data": {
    "isCustomGame": true,
    "mapName": "Valhalla",
    "gameMode": "Slayer",
    "playerCount": 6,
    "maxPlayers": 16,
    "hostName": "OfflineHost",
    "mods": ["mod_a"],
    "timestamp": "2026-02-09T20:15:00Z",
    "sessionID": "abc123def456"
  }
}
```
