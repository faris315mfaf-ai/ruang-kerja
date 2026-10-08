# Serah terima ke ZCode (GLM) — RuangKerja

**Dibuat:** Kamis, 8 Okt 2026 · oleh Claude Code (integrator) · untuk dilanjutkan di **ZCode dengan model GLM**.
**Branch acuan:** `claude/integrasi-rapat` (`3c5c2f9`), worktree `/Users/godam/PROYEK/rk-integrasi-rapat`.
**Status singkat:** semua fitur rapat video + notulen otomatis selesai dan hijau di branch integrasi, **belum di-push, belum di-merge, belum di-deploy**.

> Dokumen ini berdiri sendiri. Baca dari atas ke bawah sebelum mengubah apa pun. Aturan kode tetap di `AGENTS.md` (sumber tunggal, sudah mendukung Z-AI).

---

## 0. Cara memulai di ZCode

1. Buka folder `/Users/godam/PROYEK/rk-integrasi-rapat` (branch `claude/integrasi-rapat`) di ZCode.
2. Tempel prompt pembuka ini ke GLM:

```text
Kamu melanjutkan proyek RuangKerja (Laravel 13 + Inertia 3 React). Baca berurutan:
1) docs/SERAH-TERIMA-GLM.md  2) AGENTS.md  3) docs/HANDOFF.md  4) docs/sesi/claude.md
Bahasa balasan: Indonesia. Jangan membaca atau menampilkan isi .env. Jangan git push,
merge ke main, deploy, atau menyentuh server tanpa izin eksplisit pemilik di chat.
Kerjakan satu butir dari §6 "Pekerjaan berikutnya" per sesi, jalankan semua perintah
verifikasi di §9 sebelum melapor, lalu perbarui docs/sesi/glm.md.
```

3. Isi catatan sesi Anda di `docs/sesi/glm.md` (templat di §11). Jangan menulis di `docs/sesi/claude.md`.

**Tips untuk GLM:** konteks terbatas → baca berkas besar per bagian (mis. `sed -n 1,120p`), satu perubahan per commit, jalankan test setelah setiap langkah. Bila ragu tentang perilaku, cari test-nya dulu (`tests/Feature/...`), test adalah spesifikasi.

---

## 1. Ringkasan status (8 Okt 2026)

| Area | Status | Di mana |
|---|---|---|
| Fase 1 (sprint 0–10), UI Arus, Ruang saya | Selesai, di `main` | `main` = `b690875` (sama dengan GitHub) |
| Fase 2/3 nyata (Obrolan, Catatan, Rapat, Otomasi, OKR, Dashboard peran, Hiring) | Selesai, di `main` di balik flag `FEATURE_*` | PR #5 |
| Backlog #8–#12 (batal pengajuan disetujui, PNG struktur, tanda baca, presence board, WAL/PITR) | Selesai, di `main` | PR #8 |
| Sandi bawaan karyawan `EMPLOYEE_DEFAULT_PASSWORD` | Selesai, di `main` dan **sudah ter-deploy** | PR #11 |
| Video RuangKerja (LiveKit) versi pertama | Selesai, di `main` dan ter-deploy | PR #10 |
| **Ruang rapat arah C "Notulen Hidup"** (UI baru) | Selesai, **belum di main** | `claude/integrasi-rapat` |
| **Backend rapat** (notulen bersama, waktu bicara, Panggil, kehadiran, larangan masuk) | Selesai, **belum di main** | idem |
| **Notulen otomatis tahap 1** (worker transkripsi CPU + ringkasan DeepSeek) | Selesai, **belum di main, worker belum dipasang** | idem + `transcriber/` |
| Audit keamanan 4 putaran (R, B, T, U) | Perbaikan sudah masuk branch integrasi | `docs/security/AUDIT-RAPAT-2026-10.md` |
| Dokumentasi rapat (panduan, privasi, ops, 23 screenshot) | Selesai | `docs/fitur/rapat-video*.md`, `docs/deploy/RAPAT-VIDEO.md` |

Verifikasi terakhir di `claude/integrasi-rapat` (`3c5c2f9`): Pest **3.201 lulus** · Vitest **778 lulus** · pint + phpstan bersih · typecheck/`vp check` bersih · build OK · `collab` 23 lulus · worker pytest 34 lulus + ruff bersih · `tests/.pest/shards.json` diperbarui (266 kelas).

---

## 2. Peta repo & dokumen wajib

| Dokumen | Isi |
|---|---|
| `AGENTS.md` | Aturan kode, Definition of Done, kerja paralel, serah terima antar agen |
| `docs/HANDOFF.md` | Status sprint, cara menjalankan lokal, keputusan pemilik |
| `docs/PEMBAGIAN-TUGAS.md` | Papan tugas antar agen (klaim baris sebelum mulai) |
| `docs/sesi/*.md` | Catatan sesi per agen (`claude.md`, `codex.md`, buat `glm.md`) |
| `docs/PRD.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md` | Produk, skema (nama tabel/kolom persis), arsitektur |
| `docs/DESIGN.md`, `docs/design/ARUS-GUIDE.md`, `resources/css/tokens.css` | Sistem desain Arus (hanya token, tanpa hex di komponen) |
| `docs/PLATFORM.md` | Desktop/tablet/ponsel wajib untuk setiap layar |
| `docs/fitur/rapat-video.md` | Panduan pengguna rapat video (+ §8 keputusan pemilik) |
| `docs/fitur/rapat-video-privasi.md` | UU PDP: data, retensi, DeepSeek, persetujuan |
| `docs/fitur/rapat-video-kontrak.md` | Kontrak props/endpoint ruang rapat (backend ↔ UI) |
| `docs/fitur/notulen-otomatis-kontrak.md` | Kontrak notulen otomatis |
| `docs/deploy/RAPAT-VIDEO.md` | Server rapat LiveKit, worker notulen, runbook R1–R4 |
| `transcriber/DEPLOY.md` | Pasang worker transkripsi (Python) |
| `docs/deploy/PITR.md` | WAL archiving + pemulihan ke titik waktu |
| `docs/security/AUDIT-RAPAT-2026-10.md` | Laporan audit §1–§9 (temuan, perbaikan, rekomendasi) |
| `docs/CRITICAL.md` | Rahasia & hal kritis (daftar kunci `.env`, tanpa nilai) |

Struktur kode inti: `app/Domain/<Modul>/{Actions,Services,Queries,Enums}`, Policy per model, controller tipis, halaman `resources/js/pages/<modul>/*.tsx`, komponen fitur `resources/js/features/<modul>/*`, rute Wayfinder hasil `php artisan wayfinder:generate --with-form` (tidak di-commit).

---

## 3. Lingkungan lokal (Mac)

| Hal | Nilai |
|---|---|
| Situs utama | https://ruangkerja.test (Herd, checkout `/Users/godam/PROYEK/ruang-kerja`, branch `main`) |
| PHP / Node | Herd PHP 8.4 · Node 22 (nvm). PATH: `export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$HOME/Library/Application Support/Herd/bin:/opt/homebrew/bin:$PATH"` |
| Docker (OrbStack) | Postgres 17 `127.0.0.1:5434` · Redis `6380` · Mailpit SMTP `1026` / UI http://localhost:8026 |
| Reverb | `8081` (wss lewat sertifikat Herd) |
| LiveKit lokal | `docker compose --profile video up -d livekit` + `herd proxy livekit http://127.0.0.1:7880 --secure` → `wss://livekit.test` |
| Worker notulen lokal | jalankan **native** (bukan Docker) di Mac — lihat `transcriber/DEPLOY.md` §5 |
| Akun demo | admin@, direksi@, hr@, kadiv@, anggota@, programmer@, maya.lestari@, dio@, faris@ `…@demo.test`, sandi `password` (hanya lokal) |
| Worktree per agen | `bash scripts/agen-mulai.sh glm <branch>` → `../ruang-kerja-glm`, DB `ruangkerja_glm`, situs https://ruangkerja-glm.test. Selesai: `bash scripts/agen-selesai.sh glm --hapus-db` |

Jebakan yang sudah ditemui:
- Browser bawaan Claude/ZCode memblokir port 5173/8081 dan service worker → verifikasi UI dengan `npm run build` (hapus `public/hot`) + `node scripts/ui-shots.mjs <rute>`.
- `composer test` bisa melewati batas 300 detik composer → `COMPOSER_PROCESS_TIMEOUT=0 composer test`.
- Pest `--parallel` menahan output sampai selesai (bukan macet). Hasil keluar sebagai JSON satu baris.
- `pest --update-shards` **jangan** ditambah `--processes` (bug Pest).
- Shell `zsh`: `set -- $var` tidak memecah kata; tulis argumen eksplisit.
- `pgrep -f nama` lewat SSH ikut mencocokkan perintah SSH-nya sendiri.
- `phpunit.xml` memaksa kosong `LIVEKIT_*` (`LIVEKIT_SUBTITLES=false`), `TRANSCRIBER_*`, `MINUTES_LLM_API_KEY`, `COLLAB_SECRET`, `EMPLOYEE_DEFAULT_PASSWORD` agar test tidak bergantung pada `.env` lokal.
- Worker Python butuh venv sendiri per worktree: `cd transcriber && python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt`.
- Nomor migrasi rapat: notulen `2026_10_14_830100`, backend rapat `2026_10_14_840100`. DB dev yang pernah menjalankan nama lain perlu dicek `php artisan migrate:status`.

---

## 4. Git & GitHub

- Repo **private** `faris315mfaf-ai/ruang-kerja`. Alur: branch → PR → CI hijau → merge (merge commit). Push **hanya setelah izin pemilik**.
- **Kredensial:** Keychain macOS menyimpan akun `official-spkd` (tidak punya akses repo). Push dengan kredensial `gh` (akun aktif `faris315mfaf-ai`) tanpa mengubah konfigurasi:
  ```bash
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin <branch>
  ```
- CI (`.github/workflows/ci.yml`): Lint & typecheck · Pest 3 shard berimbang waktu · Docker images (+ build image Postgres PITR, collab, transcriber) · job worker notulen (pytest + ruff). Perbarui shard bila banyak test baru: `vendor/bin/pest --parallel --update-shards`.
- Deploy workflow (`deploy.yml`) jalan setelah CI `main` hijau tetapi **gagal di SSH** karena secret GitHub Actions belum diisi — itu diharapkan; deploy dilakukan manual (§5.1).

Branch & worktree lokal saat ini:

| Branch | Worktree | Keterangan |
|---|---|---|
| `main` (`b690875`) | `/Users/godam/PROYEK/ruang-kerja` | sama dengan GitHub; disajikan https://ruangkerja.test |
| `claude/integrasi-rapat` (`3c5c2f9`) | `/Users/godam/PROYEK/rk-integrasi-rapat` | **gabungan semua pekerjaan rapat** — yang akan di-PR |
| `claude/rapat-ui`, `claude/rapat-backend`, `claude/notulen-otomatis`, `claude/dok-rapat`, `claude/audit-*` | `ruang-kerja-{rapatui,rapatbe,notulen,dok,audit}` | sudah termuat di integrasi; aman dibersihkan setelah merge |
| `claude/sandi-bawaan` | `ruang-kerja-sandi` | sudah di main (PR #11); bersihkan |
| `codex/kerja` | `ruang-kerja-codex` | milik Codex; jangan dihapus tanpa tanya |

---

## 5. Server produksi (tanpa rahasia)

### 5.1 Server aplikasi — https://spkd.store

| Hal | Nilai |
|---|---|
| IP / akses | `187.77.118.216`, `ssh root@187.77.118.216` (kunci `~/.ssh/id_ed25519`) |
| Tata letak | `/opt/ruangkerja` (milik user `deploy`), satu server `compose.prod.yml`, kode di `src/` (+ `src/.git-sha`), image dibangun **di server** (tanpa GHCR) |
| Versi berjalan | `b6908757f39b` (main PR #11) |
| Landing | `docker/caddy/landing/index.html` → `/` (tombol LIHAT DEMO ke demo.spkd.store) |
| Catatan | `compose.prod.yml` di server **sengaja belum** memakai image Postgres PITR dari PR #8 (akan me-restart DB); dipasang terpisah nanti |

Prosedur deploy manual (urutan wajib, minta izin dulu):
```bash
# di Mac, dari checkout yang berisi commit yang mau dideploy
SHA=$(git rev-parse HEAD); S=${SHA:0:12}
git archive --format=tar.gz HEAD > /tmp/rk-src.tgz
scp /tmp/rk-src.tgz root@187.77.118.216:/root/rk-src-$S.tgz
```
```bash
# di server (ssh root@187.77.118.216), ganti S dan SHA
cd /opt/ruangkerja
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /opt/ruangkerja-backup/pre-$S.dump
rm -rf src.new && mkdir src.new && tar -xzf /root/rk-src-$S.tgz -C src.new && echo $SHA > src.new/.git-sha
rm -rf src.prev && mv src src.prev && mv src.new src && chown -R deploy:deploy src
SHA_OVERRIDE=$S bash build-images.sh > build.log 2>&1
sudo -u deploy env DEPLOY_PATH=/opt/ruangkerja APP_TAG=$S DEPLOY_PULL=0 bash deploy-remote.sh
```
Lalu cek `https://spkd.store/`, `/login`, `/health` (200). `deploy-remote.sh` menjalankan `migrate --force`, `db:seed --force` (peran), dan restart Horizon. Bila `Caddyfile`/`compose.prod.yml` di `main` berubah, salin manual ke `/opt/ruangkerja/docker/caddy/` dan `compose.prod.yml` (cadangkan dulu, `caddy validate`), lalu `docker compose up -d caddy`.

### 5.2 Server rapat — LiveKit

| Hal | Nilai |
|---|---|
| IP / akses | `103.125.181.244` (Biznet Gio NEO Lite Pro, Ubuntu 24.04, 8 vCPU, 15 GB), `ssh spkdofficial@103.125.181.244` (sudo tanpa sandi) |
| Layanan | `/opt/livekit` (Caddy L4 + LiveKit 1.13.8, tanpa Redis), systemd `livekit-docker` |
| Domain | `livekit.spkd.store` (WSS) · `turn.spkd.store` (TURN/TLS 443) — keduanya A → 103.125.181.244 (DNS di Hostinger, NS `dns-parking.com`) |
| Port terbuka (ufw + Security Group panel) | 22, 80, 443, 7881/tcp · 3478, 30000–40000, 50000–60000/udp |
| Webhook | `https://spkd.store/api/livekit/webhook` (sudah aktif, terverifikasi 200) |
| Kunci | API key/secret hanya di `/opt/livekit/livekit.yaml` (root-only) dan `.env` aplikasi — jangan disalin ke chat/repo |
| Uji | `lk load-test` dari Mac: 0% packet loss; STUN TURN/UDP & TURN/TLS OK |

---

## 6. Pekerjaan berikutnya (urut prioritas)

> Setiap butir yang menyentuh GitHub/server/data produksi **wajib izin pemilik**.

### A. Gabungkan rapat ke main
1. Push `claude/integrasi-rapat`, buka PR ke `main` (deskripsi: ringkas §1 + catatan deploy di bawah), tunggu CI hijau, merge.
2. `git pull --ff-only` di checkout utama, `composer install`, `npm ci`, `php artisan migrate`, `php artisan db:seed --class=RoleSeeder`, `npm run build`.

### B. Deploy aplikasi ke spkd.store
Ikuti §5.1. Migrasi baru: kolom notulen/rapat (830100, 840100), `meeting_speaking_times`, `meeting_video_removals`, `meeting_transcripts`, `meeting_transcript_consents`. Horizon perlu supervisor baru `supervisor-long` (antrean `long`, timeout 900) — ada di `config/horizon.php`, ikut deploy.

### C. Reset sandi bawaan semua karyawan (menunggu pemilik)
1. Pemilik mengisi `EMPLOYEE_DEFAULT_PASSWORD` sendiri (perintah aman, nilai tidak tampil):
   ```bash
   ssh -t root@187.77.118.216 'cd /opt/ruangkerja && read -rsp "Sandi bawaan: " P && echo && cp -p .env .env.bak.sandi && sed -i "/^EMPLOYEE_DEFAULT_PASSWORD=/d" .env && printf "EMPLOYEE_DEFAULT_PASSWORD=%s\n" "$P" >> .env && chown deploy:deploy .env && chmod 600 .env && unset P && docker compose exec -T app php artisan config:cache >/dev/null && echo SELESAI'
   ```
2. Lalu (setelah izin): `docker compose exec -T app php artisan ruangkerja:reset-default-passwords --dry-run`, tunjukkan daftar ke pemilik, baru `--force`.

### D. Pasang worker notulen otomatis (tahap 1, CPU)
Lihat `transcriber/DEPLOY.md` dan `docs/deploy/RAPAT-VIDEO.md` §7–§8.
1. Pemilik: DNS `notulen.spkd.store` → `103.125.181.244`.
2. Salin `transcriber/deploy/compose.notulen.yaml` + `notulen.env.example` ke `/opt/livekit`, isi dua rahasia berbeda (≥ 32 karakter) `TRANSCRIBER_SECRET` dan `TRANSCRIBER_CALLBACK_SECRET`, jalankan `docker compose -f compose.notulen.yaml --env-file notulen.env up -d` (unduh model ±1,6 GB). Image dibangun di server dari `transcriber/`.
3. Tambah route Caddy L4 dari `transcriber/deploy/caddy-notulen.yaml` ke `/opt/livekit/caddy.yaml` (cocokkan dengan berkas nyata; hanya IP server aplikasi).
4. Tambah URL webhook kedua `https://spkd.store/api/notulen/livekit` di `livekit.yaml` → `systemctl restart livekit-docker`.
5. `.env` aplikasi: `TRANSCRIBER_URL=https://notulen.spkd.store`, `TRANSCRIBER_SECRET`, `TRANSCRIBER_CALLBACK_SECRET`, `MINUTES_LLM_BASE_URL=https://api.deepseek.com`, `MINUTES_LLM_MODEL=deepseek-chat`, `MINUTES_TRANSCRIPT_RETENTION_DAYS=90`, `REDIS_LONG_QUEUE_RETRY_AFTER=960`; **`MINUTES_LLM_API_KEY` diisi pemilik sendiri**. `config:cache`, restart Horizon.
6. Ukur kecepatan di server: `python -m notulen.bench /data/contoh.wav --threads 4` di dalam kontainer worker (DEPLOY.md §3). Perkiraan RTF 0,6–1,0 pada 4 vCPU.
7. Uji rapat nyata dengan `auto_minutes` menyala; ikuti runbook R2/R3 bila transkrip/ringkasan tidak muncul.

### E. Bersih-bersih lokal (setelah A)
```bash
for a in rapatui rapatbe notulen dok audit sandi; do bash scripts/agen-selesai.sh $a --hapus-db; done
git worktree remove ../rk-integrasi-rapat   # setelah merge
herd unproxy livekit-rapatui; herd unproxy livekit-dok   # bila masih ada
```
Lalu hapus branch lokal yang sudah ter-merge (`git branch -d …`).

### F. Rekomendasi audit yang belum dikerjakan (kecil)
| ID | Isi | Pemilik berkas |
|---|---|---|
| U-06 | Muat Hocuspocus/Yjs (111 KB) secara dinamis hanya saat mode kolaborasi | `features/meetings/video/use-minutes-collab.ts` |
| R-14 | Batasi Permissions-Policy mikrofon ke rute rapat (butuh muat ulang penuh ke `/gabung`) | `SecurityHeaders` |
| R-06 | **Keputusan pemilik:** HR boleh mengatur sandi Direksi/HR lain? Usulan: hanya Super Admin | `UserPolicy::setPassword` |
| B-06..B-08, T-08..T-10 | Sudah diperbaiki — tidak ada tindakan | — |

### G. Tahap 2 — subtitle realtime (butuh GPU)
Server GPU terpisah (NVIDIA L4/T4 16–24 GB). Model **Qwen3-ASR-1.7B** (Apache-2.0, WER Indonesia ±5%) lewat vLLM streaming; worker kirim teks ke LiveKit topik `lk.transcription` sebagai **peserta agen yang tidak tersembunyi** (peserta hidden tidak sampai ke browser di LiveKit 1.13.8). UI sudah siap (hanya menerima dari identitas `rk-notulen`). Rincian: `docs/deploy/RAPAT-VIDEO.md` §10.

### H. Aplikasi Android (belum dimulai, menunggu pemilik)
Jalur bertahap: (1) TWA/Bubblewrap 1–2 hari → (2) Capacitor 2–4 minggu untuk push FCM, biometrik, anti GPS palsu. Butuh: akun Google Play Console (US$25), nama paket (usulan `store.spkd.ruangkerja`), keystore, Firebase, `assetlinks.json` di spkd.store, kebijakan privasi publik.

---

## 7. Keputusan pemilik yang menunggu

1. **Notulen otomatis opt-in atau opt-out** (UU PDP, data ke luar negeri). Sekarang: opt-out.
2. **Dasar Pasal 56 UU PDP** untuk DeepSeek (usulan: persetujuan tertulis + pemberitahuan).
3. **Kenaikan `PRIVACY_POLICY_VERSION`** (memaksa semua karyawan setuju ulang sebelum absen).
4. **Retensi `meeting_attendances`** (waktu bicara & transkrip sudah 90 hari).
5. **Data rapat di ekspor "Data Saya"** atau tidak.
6. **R-06:** reset sandi Direksi/HR hanya oleh Super Admin?
7. **R-04:** perilaku "izinkan masuk lagi" setelah dikeluarkan (sekarang per kemunculan, penyelenggara bisa mengizinkan).
8. Belum ada: kredensial Google Cloud, secret GitHub Actions, branding resmi SPKD, `ATTENDANCE_QR_SECRET` produksi, object storage NEO + PITR aktif.

---

## 8. Aturan kerja (ringkas, lengkapnya `AGENTS.md`)

- Bahasa UI & balasan: Indonesia. Kode, nama kelas, commit: Conventional Commits (deskripsi boleh Indonesia).
- **Jangan** membaca/menampilkan `.env`, rahasia, token; jangan menulis nilai sandi/kunci ke repo, log, atau chat.
- **Jangan** push/merge/deploy/ubah server tanpa izin eksplisit pemilik untuk tindakan itu.
- Backend: Action + Policy + `visibleTo`, ULID, migrasi bisa di-rollback (+ `docs/DATABASE.md` di commit yang sama), audit untuk aksi sensitif, panggilan eksternal lewat job.
- Frontend: token Arus saja (test `lib/color-tokens.test.ts` gagal bila ada hex/kelas palet), desktop + ponsel, terang + Malam, target sentuh ≥ 44 px, `prefers-reduced-motion`.
- Setiap Action & Policy punya test (Pest, matriks peran); halaman/list baru punya test anggaran query (`tests/Feature/Performance/PageQueryCountTest.php`).
- Fitur Fase 2/3 di balik flag `FEATURE_*` (mati di produksi kecuali diputuskan).

---

## 9. Verifikasi (wajib sebelum melapor)

```bash
COMPOSER_PROCESS_TIMEOUT=0 composer test        # Pest paralel, ±3.200 test, 4–8 menit
composer lint                                    # pint --test + phpstan level 8
npm run typecheck && npm run lint && npm test    # tsc, vp check, Vitest
rm -f public/hot && npm run build
(cd collab && npm test)                          # bila menyentuh collab/
(cd transcriber && .venv/bin/pytest -q && .venv/bin/ruff check . && .venv/bin/ruff format --check .)   # bila menyentuh worker
node scripts/ui-shots.mjs <rute>                 # bila menyentuh UI; lihat PNG-nya
```
Migrasi baru: `php artisan migrate:rollback` lalu `php artisan migrate` di DB dev worktree.

---

## 10. Rujukan cepat fitur rapat

- **Rute:** `/rapat`, `/rapat/baru`, `/rapat/{id}` (detail + kartu Notulen otomatis), `/rapat/{id}/gabung`, `/rapat/{id}/ruang`, `/rapat/{id}/notulen-otomatis?tanggal=…`, `/kalender`, `/manajemen/jadwal`.
- **Webhook:** `POST /api/livekit/webhook` (kehadiran), `POST /api/notulen/livekit` (perintah worker), `POST /api/notulen/transcript` (hasil transkrip, HMAC).
- **Kanal realtime:** private `meeting.{id}` (speaking.updated, minutes.*, attendance.updated, participant.called/readmitted).
- **Identitas worker:** `rk-notulen` (diabaikan di kehadiran; satu-satunya sumber subtitle yang diterima UI).
- **Domain:** `app/Domain/Meetings/**` (video, kehadiran, notulen), `app/Domain/Meetings/Transcripts/**` (notulen otomatis), `transcriber/` (Python 3.12, faster-whisper `large-v3-turbo` int8, model disematkan hash).
- **Mockup desain arah C:** artifact https://claude.ai/artifact/GkUXvhXQ2HKfatrCn2HtLE (privat, hanya pemilik).

---

## 11. Templat catatan sesi `docs/sesi/glm.md`

```markdown
# Sesi glm

**Terakhir diperbarui:** <tanggal jam> · ZCode (GLM)

## Tugas berjalan
<satu kalimat; butir §6 dari docs/SERAH-TERIMA-GLM.md>

## Worktree / branch
<folder> · <branch> · https://ruangkerja-glm.test

## Sudah selesai
- `<hash>` <ringkasan commit>

## Langkah berikutnya
1. …

## Butuh dari pemilik / agen lain
- …

## Verifikasi terakhir
composer test · composer lint · npm run typecheck · npm run lint · npm test · npm run build
```
