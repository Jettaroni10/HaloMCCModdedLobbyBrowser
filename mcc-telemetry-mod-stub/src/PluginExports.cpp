#include "TelemetryMod.h"

#include <Windows.h>

namespace {

mccmod::TelemetryMod g_mod;

}  // namespace

extern "C" __declspec(dllexport) void InitializeMod() {
  g_mod.Initialize();
}

extern "C" __declspec(dllexport) void ShutdownMod() {
  g_mod.Shutdown();
}

BOOL APIENTRY DllMain(HMODULE, DWORD reason, LPVOID) {
  (void)reason;
  // Keep DllMain lightweight. The framework should call ShutdownMod explicitly.
  return TRUE;
}
