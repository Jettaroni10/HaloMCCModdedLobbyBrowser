$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$overlayDir = Join-Path $repoRoot "mcc-telemetry-mod-stub"
$overlayExe = Join-Path $overlayDir "build\\Release\\mcc_player_overlay.exe"
$pcAppDir = Join-Path $repoRoot "pc-app"

if (-not (Test-Path $overlayExe)) {
  Write-Host "Overlay exe not found. Building..."
  Push-Location $overlayDir
  cmake --build build --config Release --target mcc_player_overlay
  Pop-Location
}

Write-Host "Launching memory reader..."
Start-Process -FilePath $overlayExe -WorkingDirectory $overlayDir

Write-Host "Launching PC app + overlay..."
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $pcAppDir

Write-Host "Done."
