!macro customUnInstall
  ; Remove HMCC overlay telemetry artifacts only (do not remove MCC folders).
  Delete "$APPDATA\\MCC\\customs_state.json"
  Delete "$APPDATA\\MCC\\customs_state.json.bak.*"

  ; Remove per-user overlay data (roaming).
  RMDir /r "$APPDATA\\HMCC Overlay"

  ; Remove cache/logs (local app data).
  ExpandEnvStrings $0 "%LOCALAPPDATA%"
  StrCmp $0 "" doneLocal
  RMDir /r "$0\\HMCC Overlay"
  doneLocal:
!macroend
