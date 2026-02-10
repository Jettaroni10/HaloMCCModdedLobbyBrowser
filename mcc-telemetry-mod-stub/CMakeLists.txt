cmake_minimum_required(VERSION 3.21)
project(MccTelemetryModStub LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(mcc_telemetry_mod SHARED
  src/PluginExports.cpp
  src/TelemetryMod.cpp
  src/TelemetryContract.cpp
  src/OfficialApiAdapter.cpp
  src/Settings.cpp
  src/HttpClientWinHttp.cpp
)

target_include_directories(mcc_telemetry_mod PRIVATE include)

target_compile_definitions(mcc_telemetry_mod PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX)

target_link_libraries(mcc_telemetry_mod PRIVATE winhttp)

set_target_properties(mcc_telemetry_mod PROPERTIES
  OUTPUT_NAME "MccTelemetryMod"
)

add_executable(mcc_player_overlay WIN32
  src/MCC_PlayerCountOverlay.cpp
)

target_compile_definitions(mcc_player_overlay PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX)
