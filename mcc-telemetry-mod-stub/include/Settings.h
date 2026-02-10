#pragma once

#include <string>

namespace mccmod {

struct ModSettings {
  bool enabled = true;
  bool offline_only = true;
  bool allow_when_anti_cheat_active = false;
  int update_interval_ms = 2000;
  std::string endpoint = "http://127.0.0.1:4760/telemetry";
  bool debug_mode = false;
};

ModSettings LoadSettings();
std::string GetDefaultSettingsPath();

}  // namespace mccmod
