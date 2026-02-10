# MCC Telemetry Mod Stub (Official API Only)

This folder contains a DLL plugin scaffold that posts telemetry snapshots to the local receiver at `http://127.0.0.1:4760/telemetry`.

## Scope

- Uses exported mod entrypoints: `InitializeMod`, `ShutdownMod`
- Uses a worker loop for periodic telemetry sends
- Uses strict payload contract (`version: 1.0` + `data`)
- Includes safety gates (`offlineOnly`, anti-cheat gate)
- Does **not** include memory reading, hooking, or undocumented APIs

## Build

From a Visual Studio Developer PowerShell:

```powershell
cd mcc-telemetry-mod-stub
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

Output DLL:

```text
mcc-telemetry-mod-stub/build/Release/MccTelemetryMod.dll
```

## Configure

Settings file path expected by the DLL:

```text
%APPDATA%\MCC\telemetry_mod_settings.json
```

Start from `config/telemetry_mod_settings.json`.

## Wire Your Official MCC API

Implement these methods in `src/OfficialApiAdapter.cpp`:

- `IsApiAvailable()`
- `IsOfflineCustomContext()`
- `IsAntiCheatActive()`
- `TryReadSnapshot(TelemetrySnapshot* out_snapshot)`

Required snapshot fields while in custom game:

- `is_custom_game`
- `map_name`
- `game_mode`
- `player_count`
- `max_players`
- `session_id`

Optional fields:

- `host_name`
- `mods`

## Receiver Integration

Run the local receiver in the repo root:

```powershell
npm run telemetry:receiver
```

Then run the desktop app:

```powershell
npm run pc-app:dev
```

## Runtime Behavior

- Posts telemetry every `updateInterval` ms
- If safety checks fail, sends one inactive snapshot and pauses
- On shutdown, sends an inactive snapshot with last known session id

## Optional Stub Source

For smoke testing before wiring official API calls, set:

```powershell
$env:MCC_TELEMETRY_STUB = "1"
```

When enabled, `OfficialApiAdapter` emits synthetic offline custom-game snapshots.

## Notes

- This scaffold is intentionally API-agnostic. It will not emit live MCC state until you map your official modding API calls in `OfficialApiAdapter.cpp`.
