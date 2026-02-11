!macro customUnInstall
  ; Remove HMCC overlay telemetry artifacts only (do not remove MCC folders).
  Delete "$APPDATA\\MCC\\customs_state.json"
  Delete "$APPDATA\\MCC\\customs_state.json.bak.*"

  ; Remove per-user overlay data (roaming).
  RMDir /r "$APPDATA\\${APP_FILENAME}"
  !ifdef APP_PRODUCT_FILENAME
    RMDir /r "$APPDATA\\${APP_PRODUCT_FILENAME}"
  !endif
  !ifdef APP_PACKAGE_NAME
    RMDir /r "$APPDATA\\${APP_PACKAGE_NAME}"
  !endif

  ; Remove cache/logs (local app data).
  ExpandEnvStrings $0 "%LOCALAPPDATA%"
  StrCmp $0 "" doneLocal
  RMDir /r "$0\\${APP_FILENAME}"
  !ifdef APP_PRODUCT_FILENAME
    RMDir /r "$0\\${APP_PRODUCT_FILENAME}"
  !endif
  !ifdef APP_PACKAGE_NAME
    RMDir /r "$0\\${APP_PACKAGE_NAME}"
  !endif
  doneLocal:

  ; Remove auto-start entry if it exists.
  DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "HMCC Overlay"
!macroend
