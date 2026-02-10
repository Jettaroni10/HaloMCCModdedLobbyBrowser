#include "OfficialApiAdapter.h"

#include "TelemetryContract.h"

#include <Windows.h>

#include <atomic>
#include <string>

namespace mccmod {
namespace {

bool IsStubSourceEnabled() {
  char value[8] = {0};
  const DWORD size = GetEnvironmentVariableA("MCC_TELEMETRY_STUB", value, 8);
  if (size == 0) return false;
  return value[0] == '1';
}

}  // namespace

bool OfficialApiAdapter::IsApiAvailable() const {
  if (IsStubSourceEnabled()) {
    return true;
  }
  // TODO: Replace with your official MCC modding API availability check.
  return false;
}

bool OfficialApiAdapter::IsOfflineCustomContext() const {
  if (IsStubSourceEnabled()) {
    return true;
  }
  // TODO: Replace with API checks for offline/custom game context.
  return false;
}

bool OfficialApiAdapter::IsAntiCheatActive() const {
  // TODO: Replace with supported API call if available.
  // This mod should fail-closed and not emit telemetry when uncertain.
  return false;
}

bool OfficialApiAdapter::TryReadSnapshot(TelemetrySnapshot* out_snapshot) const {
  if (!out_snapshot) return false;

  if (IsStubSourceEnabled()) {
    static std::atomic<int> tick{0};
    const int value = ++tick;
    out_snapshot->is_custom_game = true;
    out_snapshot->map_name = "Valhalla";
    out_snapshot->game_mode = "Slayer";
    out_snapshot->player_count = 4 + (value % 6);
    out_snapshot->max_players = 16;
    out_snapshot->host_name = "StubHost";
    out_snapshot->mods = {"stub_mod_alpha", "stub_mod_beta"};
    out_snapshot->timestamp_utc = GetIsoUtcNow();
    out_snapshot->session_id = "stub-session-001";
    return true;
  }

  // TODO: Populate from official API.
  // Required fields for custom games: is_custom_game, map_name, game_mode,
  // player_count, max_players, session_id.
  // Optional: host_name, mods.
  return false;
}

}  // namespace mccmod
