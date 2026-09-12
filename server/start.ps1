$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if ($args -contains "-ValidateOnly") {
    if (-not (Test-Path (Join-Path $Root "start.ps1"))) {
        throw "start.ps1 missing"
    }
    Write-Host "start.ps1 ok"
    exit 0
}

$eulaPath = Join-Path $Root "eula.txt"
if (-not (Test-Path $eulaPath) -or -not (Select-String -Path $eulaPath -Pattern '^eula=true' -Quiet)) {
    Write-Error "Read https://www.minecraft.net/eula then write eula=true into server/eula.txt"
    exit 1
}

$launch = Join-Path $Root "fabric-server-launch.jar"
if (-not (Test-Path $launch)) {
    Write-Error "Run server/download-server.sh first (Fabric 1.21.1)."
    exit 1
}

New-Item -ItemType Directory -Force -Path (Join-Path $Root "mods") | Out-Null
Get-ChildItem -Path (Join-Path $Root "..\mods") -Filter *.jar -ErrorAction SilentlyContinue |
    Copy-Item -Destination (Join-Path $Root "mods") -Force

java -Xmx2G -jar fabric-server-launch.jar nogui
