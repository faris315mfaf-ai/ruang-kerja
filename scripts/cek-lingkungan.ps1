# Cek prasyarat pengembangan RuangKerja di Windows.
# Jalankan dari folder proyek:  powershell -ExecutionPolicy Bypass -File .\scripts\cek-lingkungan.ps1

$ErrorActionPreference = 'SilentlyContinue'
$hasil = @()

function Cek($nama, $perintah, $syarat, $saran) {
    $out = & $perintah 2>$null
    $ok = $false
    $versi = '-'
    if ($LASTEXITCODE -eq 0 -or $out) {
        $versi = ($out | Select-Object -First 1)
        $ok = & $syarat $versi
    }
    $script:hasil += [pscustomobject]@{
        Komponen = $nama
        Status   = $(if ($ok) { 'OK' } else { 'PERLU' })
        Versi    = $versi
        Saran    = $(if ($ok) { '' } else { $saran })
    }
}

Cek 'Git'            { git --version }     { param($v) $v -match 'git version' } 'Pasang Git for Windows: https://git-scm.com/downloads/win'
Cek 'PHP 8.4'        { php -r 'echo PHP_VERSION;' } { param($v) $v -match '^8\.(4|5)' } 'Pasang Laravel Herd lalu pilih PHP 8.4 (Herd > PHP)'
Cek 'Composer'       { composer -V }       { param($v) $v -match 'Composer' } 'Composer ikut terpasang bersama Herd; buka terminal baru'
Cek 'Node.js 22+'    { node -v }           { param($v) [int]($v -replace '^v(\d+).*','$1') -ge 22 } 'Herd > Node: pasang Node 22 LTS (atau https://nodejs.org)'
Cek 'Docker'         { docker --version }  { param($v) $v -match 'Docker version' } 'Pasang Docker Desktop (backend WSL 2) dan jalankan'
Cek 'Docker berjalan'{ docker info --format '{{.ServerVersion}}' } { param($v) $v -ne '' -and $v -ne $null } 'Buka aplikasi Docker Desktop sampai status Running'
Cek 'Claude Code'    { claude --version }  { param($v) $v -match '\d+\.\d+' } 'irm https://claude.ai/install.ps1 | iex   (PowerShell)'
Cek 'Herd CLI'       { herd --version }    { param($v) $v -ne $null } 'Opsional: pastikan Herd terpasang dan terminal dibuka ulang'

# Lokasi PHP & php.ini yang aktif (membantu bila ada lebih dari satu PHP)
$phpPath = (Get-Command php -ErrorAction SilentlyContinue).Source
$phpIni  = php -r 'echo php_ini_loaded_file() ?: "(tidak ada php.ini)";' 2>$null
$viaHerd = $phpPath -match 'herd'
$hasil += [pscustomobject]@{
    Komponen = 'PHP dipakai'
    Status   = $(if ($viaHerd) { 'OK' } else { 'CEK' })
    Versi    = "$phpPath"
    Saran    = $(if ($viaHerd) { '' } else { "Bukan PHP Herd. Setelah Herd terpasang, buka terminal baru; bila masih bukan Herd, pindahkan folder bin Herd ke urutan atas PATH. php.ini aktif: $phpIni" })
}

# Ekstensi PHP wajib
$ext = (php -m) -join ' '
foreach ($e in @('pdo_pgsql','pgsql','intl','mbstring','zip','fileinfo','openssl')) {
    $hasil += [pscustomobject]@{
        Komponen = "ext-$e"
        Status   = $(if ($ext -match "\b$e\b") { 'OK' } else { 'PERLU' })
        Versi    = ''
        Saran    = $(if ($ext -match "\b$e\b") { '' } else { "Aktifkan $e di php.ini Herd (Herd > PHP > buka php.ini), lalu restart Herd" })
    }
}

# Port yang dipakai
foreach ($p in @(5432, 6379, 1025, 8025, 8080, 5173)) {
    $pakai = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    $hasil += [pscustomobject]@{
        Komponen = "port $p"
        Status   = $(if ($pakai) { 'DIPAKAI' } else { 'BEBAS' })
        Versi    = $(if ($pakai) { (Get-Process -Id $pakai[0].OwningProcess).ProcessName } else { '' })
        Saran    = $(if ($p -eq 5432 -and $pakai) { 'Normal bila itu container postgres. Bila PostgreSQL lain, ubah DB_FORWARD_PORT & DB_PORT' } else { '' })
    }
}

# Lokasi proyek
$lok = (Get-Location).Path
$bahaya = $lok -match 'OneDrive|Dropbox|Google Drive'
$hasil += [pscustomobject]@{
    Komponen = 'Lokasi folder'
    Status   = $(if ($bahaya) { 'PERLU' } else { 'OK' })
    Versi    = $lok
    Saran    = $(if ($bahaya) { 'Pindahkan proyek keluar dari folder sinkron cloud (mis. C:\Users\Admin\ruang-kerja)' } else { '' })
}

$hasil | Format-Table -AutoSize -Wrap
$kurang = ($hasil | Where-Object Status -eq 'PERLU').Count
if ($kurang -eq 0) { Write-Host "`nSemua prasyarat terpenuhi. Lanjut: docker compose up -d, lalu buka Claude Code (claude --chrome)." -ForegroundColor Green }
else { Write-Host "`n$kurang item perlu dibereskan (lihat kolom Saran)." -ForegroundColor Yellow }
