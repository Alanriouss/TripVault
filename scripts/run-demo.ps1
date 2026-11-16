# TripVault 1-Click Demo Launcher for Windows
$ErrorActionPreference = 'Stop'

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "           TRIPVAULT - DEMO LAUNCHER              " -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Locate Bun runtime
$bunPath = "bun"
if (-not (Get-Command "bun" -ErrorAction SilentlyContinue)) {
    $userBun = Join-Path $HOME ".bun\bin\bun.exe"
    if (Test-Path $userBun) {
        $bunPath = $userBun
    } else {
        Write-Host "Bun runtime is not found in PATH or $HOME\.bun\bin." -ForegroundColor Red
        Write-Host "Installing Bun..." -ForegroundColor Yellow
        powershell -c "irm bun.sh/install.ps1|iex"
        $bunPath = Join-Path $HOME ".bun\bin\bun.exe"
    }
}

# 2. Determine Port
$port = 8788
$inUse = Get-NetTCPConnection -LocalPort 8788 -ErrorAction SilentlyContinue
if ($inUse) {
    $port = 8789
    Write-Host "Port 8788 is busy. Switching to port $port." -ForegroundColor Yellow
}

$env:TRIPVAULT_PORT = "$port"
$demoUrl = "http://127.0.0.1:$port/?demo=1"

Write-Host "`nStarting TripVault Server on port $port..." -ForegroundColor Green
Write-Host "Demo URL: $demoUrl" -ForegroundColor Cyan
Write-Host "Opening your web browser..." -ForegroundColor Gray

# Open browser after a slight delay
Start-Process $demoUrl

Write-Host "`nServer is running! Press Ctrl+C in this window to stop.`n" -ForegroundColor Green
& $bunPath "outputs/TripVault_Room_Server.mjs"
