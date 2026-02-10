#include "TelemetryMod.h"

#include "HttpClientWinHttp.h"
#include "OfficialApiAdapter.h"
#include "Settings.h"
#include "TelemetryContract.h"

#include <Windows.h>

#include <chrono>
#include <string>
#include <thread>

namespace mccmod {
namespace {

void LogLine(const std::string& line, bool always = false, bool debug_mode = false) {
  if (!always && !debug_mode) return;
  OutputDebugStringA(("[MccTelemetryMod] " + line + "\n").c_str());
}

TelemetrySnapshot BuildInactiveSnapshot(const std::string& session_id) {
  TelemetrySnapshot snapshot;
  snapshot.is_custom_game = false;
  snapshot.session_id = session_id;
  snapshot.timestamp_utc = GetIsoUtcNow();
  return snapshot;
}

}  // namespace

void TelemetryMod::Initialize() {
  if (initialized_) return;
  initialized_ = true;
  running_.store(true);
  worker_ = std::thread(&TelemetryMod::WorkerLoop, this);
}

void TelemetryMod::Shutdown() {
  if (!initialized_) return;
  running_.store(false);
  if (worker_.joinable()) {
    worker_.join();
  }
  initialized_ = false;
}

void TelemetryMod::WorkerLoop() {
  OfficialApiAdapter adapter;
  bool had_active_snapshot = false;
  bool api_unavailable_logged = false;
  std::string last_session_id;

  while (running_.load()) {
    const ModSettings settings = LoadSettings();

    if (!settings.enabled) {
      std::this_thread::sleep_for(std::chrono::milliseconds(1000));
      continue;
    }

    if (!adapter.IsApiAvailable()) {
      if (!api_unavailable_logged) {
        LogLine("Official API unavailable. Adapter not wired yet.", true, settings.debug_mode);
        api_unavailable_logged = true;
      }
      std::this_thread::sleep_for(std::chrono::milliseconds(settings.update_interval_ms));
      continue;
    }
    api_unavailable_logged = false;

    bool can_emit = true;
    if (settings.offline_only && !adapter.IsOfflineCustomContext()) {
      can_emit = false;
    }

    if (!settings.allow_when_anti_cheat_active && adapter.IsAntiCheatActive()) {
      can_emit = false;
    }

    if (!can_emit) {
      if (had_active_snapshot) {
        TelemetrySnapshot inactive = BuildInactiveSnapshot(last_session_id);
        const HttpResponse response =
            HttpPostJson(settings.endpoint, BuildTelemetryEnvelopeJson(inactive));
        LogLine(response.ok ? "Sent inactive snapshot due to safety gate."
                            : "Failed to send inactive snapshot due to safety gate.",
                true, settings.debug_mode);
        had_active_snapshot = false;
      }
      std::this_thread::sleep_for(std::chrono::milliseconds(settings.update_interval_ms));
      continue;
    }

    TelemetrySnapshot snapshot;
    if (adapter.TryReadSnapshot(&snapshot)) {
      snapshot.timestamp_utc = GetIsoUtcNow();
      std::string validation_error;
      if (ValidateSnapshot(snapshot, &validation_error)) {
        const HttpResponse response =
            HttpPostJson(settings.endpoint, BuildTelemetryEnvelopeJson(snapshot));
        if (!response.ok) {
          LogLine("Failed to post telemetry snapshot.", true, settings.debug_mode);
        } else {
          had_active_snapshot = snapshot.is_custom_game;
          last_session_id = snapshot.session_id;
        }
      } else {
        LogLine("Snapshot validation failed: " + validation_error, true, settings.debug_mode);
      }
    }

    std::this_thread::sleep_for(std::chrono::milliseconds(settings.update_interval_ms));
  }

  const ModSettings settings = LoadSettings();
  if (settings.enabled && !last_session_id.empty()) {
    TelemetrySnapshot inactive = BuildInactiveSnapshot(last_session_id);
    HttpPostJson(settings.endpoint, BuildTelemetryEnvelopeJson(inactive));
  }
}

}  // namespace mccmod
