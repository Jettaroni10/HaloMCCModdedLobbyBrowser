#include "TelemetryContract.h"

#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

namespace mccmod {
namespace {

std::string EscapeJson(const std::string& input) {
  std::ostringstream out;
  for (char c : input) {
    switch (c) {
      case '"':
        out << "\\\"";
        break;
      case '\\':
        out << "\\\\";
        break;
      case '\b':
        out << "\\b";
        break;
      case '\f':
        out << "\\f";
        break;
      case '\n':
        out << "\\n";
        break;
      case '\r':
        out << "\\r";
        break;
      case '\t':
        out << "\\t";
        break;
      default:
        out << c;
        break;
    }
  }
  return out.str();
}

}  // namespace

std::string GetIsoUtcNow() {
  using clock = std::chrono::system_clock;
  const auto now = clock::now();
  const std::time_t raw_time = clock::to_time_t(now);

  std::tm utc{};
#if defined(_WIN32)
  gmtime_s(&utc, &raw_time);
#else
  gmtime_r(&raw_time, &utc);
#endif

  std::ostringstream out;
  out << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
  return out.str();
}

bool ValidateSnapshot(const TelemetrySnapshot& snapshot, std::string* error) {
  if (snapshot.player_count < 0 || snapshot.player_count > 32) {
    if (error) *error = "playerCount out of range (0-32).";
    return false;
  }
  if (snapshot.max_players < 0 || snapshot.max_players > 32) {
    if (error) *error = "maxPlayers out of range (0-32).";
    return false;
  }
  if (snapshot.max_players > 0 && snapshot.player_count > snapshot.max_players) {
    if (error) *error = "playerCount exceeds maxPlayers.";
    return false;
  }
  if (snapshot.is_custom_game) {
    if (snapshot.map_name.empty()) {
      if (error) *error = "Missing mapName while in custom game.";
      return false;
    }
    if (snapshot.game_mode.empty()) {
      if (error) *error = "Missing gameMode while in custom game.";
      return false;
    }
  }
  return true;
}

std::string BuildTelemetryEnvelopeJson(const TelemetrySnapshot& snapshot) {
  std::ostringstream mods;
  mods << "[";
  for (size_t i = 0; i < snapshot.mods.size(); ++i) {
    if (i > 0) mods << ",";
    mods << '"' << EscapeJson(snapshot.mods[i]) << '"';
  }
  mods << "]";

  std::ostringstream out;
  out << "{";
  out << "\"version\":\"1.0\",";
  out << "\"data\":{";
  out << "\"isCustomGame\":" << (snapshot.is_custom_game ? "true" : "false") << ",";
  out << "\"mapName\":\"" << EscapeJson(snapshot.map_name) << "\",";
  out << "\"gameMode\":\"" << EscapeJson(snapshot.game_mode) << "\",";
  out << "\"playerCount\":" << snapshot.player_count << ",";
  out << "\"maxPlayers\":" << snapshot.max_players << ",";
  out << "\"hostName\":\"" << EscapeJson(snapshot.host_name) << "\",";
  out << "\"mods\":" << mods.str() << ",";
  out << "\"timestamp\":\"" << EscapeJson(snapshot.timestamp_utc) << "\",";
  out << "\"sessionID\":\"" << EscapeJson(snapshot.session_id) << "\"";
  out << "}";
  out << "}";

  return out.str();
}

}  // namespace mccmod
