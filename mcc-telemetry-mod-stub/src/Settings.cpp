#include "Settings.h"

#include <Windows.h>

#include <algorithm>
#include <fstream>
#include <sstream>
#include <string>

namespace mccmod {
namespace {

std::string GetEnvVar(const char* name) {
  const DWORD required = GetEnvironmentVariableA(name, nullptr, 0);
  if (required == 0) return {};
  std::string buffer(required, '\0');
  const DWORD written = GetEnvironmentVariableA(name, buffer.data(), required);
  if (written == 0) return {};
  if (!buffer.empty() && buffer.back() == '\0') buffer.pop_back();
  return buffer;
}

std::string ReadFileText(const std::string& path) {
  std::ifstream file(path, std::ios::in | std::ios::binary);
  if (!file) return {};
  std::ostringstream out;
  out << file.rdbuf();
  return out.str();
}

bool FindJsonBool(const std::string& json, const std::string& key, bool* out) {
  const std::string probe = "\"" + key + "\"";
  const size_t key_pos = json.find(probe);
  if (key_pos == std::string::npos) return false;
  const size_t colon = json.find(':', key_pos + probe.size());
  if (colon == std::string::npos) return false;
  const size_t value_pos = json.find_first_not_of(" \t\r\n", colon + 1);
  if (value_pos == std::string::npos) return false;

  if (json.compare(value_pos, 4, "true") == 0) {
    *out = true;
    return true;
  }
  if (json.compare(value_pos, 5, "false") == 0) {
    *out = false;
    return true;
  }
  return false;
}

bool FindJsonInt(const std::string& json, const std::string& key, int* out) {
  const std::string probe = "\"" + key + "\"";
  const size_t key_pos = json.find(probe);
  if (key_pos == std::string::npos) return false;
  const size_t colon = json.find(':', key_pos + probe.size());
  if (colon == std::string::npos) return false;
  const size_t value_pos = json.find_first_not_of(" \t\r\n", colon + 1);
  if (value_pos == std::string::npos) return false;

  size_t end = value_pos;
  if (json[end] == '-') ++end;
  while (end < json.size() && json[end] >= '0' && json[end] <= '9') ++end;
  if (end == value_pos) return false;

  *out = std::stoi(json.substr(value_pos, end - value_pos));
  return true;
}

bool FindJsonString(const std::string& json, const std::string& key,
                    std::string* out) {
  const std::string probe = "\"" + key + "\"";
  const size_t key_pos = json.find(probe);
  if (key_pos == std::string::npos) return false;
  const size_t colon = json.find(':', key_pos + probe.size());
  if (colon == std::string::npos) return false;
  const size_t quote_start = json.find('"', colon + 1);
  if (quote_start == std::string::npos) return false;

  size_t cursor = quote_start + 1;
  std::string value;
  while (cursor < json.size()) {
    const char c = json[cursor++];
    if (c == '\\' && cursor < json.size()) {
      value.push_back(json[cursor++]);
      continue;
    }
    if (c == '"') {
      *out = value;
      return true;
    }
    value.push_back(c);
  }
  return false;
}

int ClampInt(int value, int min_value, int max_value) {
  return std::max(min_value, std::min(max_value, value));
}

}  // namespace

std::string GetDefaultSettingsPath() {
  const std::string app_data = GetEnvVar("APPDATA");
  if (app_data.empty()) return "telemetry_mod_settings.json";
  return app_data + "\\MCC\\telemetry_mod_settings.json";
}

ModSettings LoadSettings() {
  ModSettings settings;

  const std::string settings_path = GetDefaultSettingsPath();
  const std::string json = ReadFileText(settings_path);

  bool bool_value = false;
  int int_value = 0;
  std::string str_value;

  if (FindJsonBool(json, "enabled", &bool_value)) {
    settings.enabled = bool_value;
  }
  if (FindJsonBool(json, "offlineOnly", &bool_value)) {
    settings.offline_only = bool_value;
  }
  if (FindJsonBool(json, "allowWhenAntiCheatActive", &bool_value)) {
    settings.allow_when_anti_cheat_active = bool_value;
  }
  if (FindJsonBool(json, "debugMode", &bool_value)) {
    settings.debug_mode = bool_value;
  }
  if (FindJsonInt(json, "updateInterval", &int_value)) {
    settings.update_interval_ms = ClampInt(int_value, 500, 10000);
  }
  if (FindJsonString(json, "endpoint", &str_value) && !str_value.empty()) {
    settings.endpoint = str_value;
  }

  return settings;
}

}  // namespace mccmod
