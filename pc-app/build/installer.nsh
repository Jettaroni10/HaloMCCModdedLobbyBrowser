!macro customUnInstall
  ; Remove per-user overlay data (roaming).
  RMDir /r "$APPDATA\\HMCC Overlay"
  !ifdef APP_PRODUCT_FILENAME
    RMDir /r "$APPDATA\\${APP_PRODUCT_FILENAME}"
  !endif
  !ifdef APP_FILENAME
    RMDir /r "$APPDATA\\${APP_FILENAME}"
  !endif

  ; Remove cache/logs (local app data).
  ExpandEnvStrings $0 "%LOCALAPPDATA%"
  StrCmp $0 "" doneLocal
  RMDir /r "$0\\HMCC Overlay"
  !ifdef APP_PRODUCT_FILENAME
    RMDir /r "$0\\${APP_PRODUCT_FILENAME}"
  !endif
  !ifdef APP_FILENAME
    RMDir /r "$0\\${APP_FILENAME}"
  !endif
  doneLocal:
!macroend
