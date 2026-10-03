# Memasang konfigurasi Claude Code proyek (izin + skill /sprint /cek-ui /cek-lokal /tinjau).
# Jalankan SEKALI dari folder proyek:  powershell -ExecutionPolicy Bypass -File .\scripts\pasang-claude.ps1
$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'claude-setup'
$dst  = Join-Path $root '.claude'
if (-not (Test-Path $src)) { Write-Host 'Folder claude-setup tidak ditemukan.' -ForegroundColor Red; exit 1 }
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force
Remove-Item -Recurse -Force $src
Write-Host "Konfigurasi Claude Code terpasang di $dst" -ForegroundColor Green
Get-ChildItem -Recurse $dst | Where-Object { -not $_.PSIsContainer } | ForEach-Object { $_.FullName.Replace($root + '\', '') }
