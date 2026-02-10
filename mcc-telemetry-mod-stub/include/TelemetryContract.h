#pragma once

#include <string>
#include <vector>

namespace mccmod {

struct TelemetrySnapshot {
  bool is_custom_game = false;
  std::string map_name;
  std::string game_mode;
  int player_count = 0;
  int max_players = 0;
  std::string host_name;
  std::vector<std::string> mods;
  std::string timestamp_utc;
  std::string session_id;
};

std::string GetIsoUtcNow();
bool ValidateSnapshot(const TelemetrySnapshot& snapshot, std::string* error);
std::string BuildTelemetryEnvelopeJson(const TelemetrySnapshot& snapshot);

}  // namespace mccmod
