# Deploy — WhatsApp grup manajemen (Evolution API)

Gateway self-hosted [Evolution API](https://github.com/evolution-foundation/evolution-api) (Docker Hub `evoapicloud/evolution-api`) di server aplikasi. Fitur: `docs/fitur/absensi-whatsapp.md`. **Gunakan nomor gateway khusus** — protokol WhatsApp Web tak resmi berisiko nomor diblokir; jangan pakai nomor pribadi/manajemen.

## 1. Siapkan kontainer (sekali)

```bash
# di server, /opt/ruangkerja
docker compose --profile whatsapp up -d evolution   # bawa compose.prod.yml terbaru ke server dulu
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" evolution'
```

Kontainer hanya bisa dijangkau dari jaringan internal Docker (tanpa port publik).

## 2. Isi `.env` aplikasi (rahasia diisi pemilik sendiri)

```
NOTIFICATIONS_WHATSAPP_ENABLED=true
EVOLUTION_URL=http://evolution:8080
EVOLUTION_API_KEY=<api-key-global>
EVOLUTION_INSTANCE=ruangkerja
WHATSAPP_GROUP_JID=<…@g.us>   # cadangan; grup per perusahaan lewat company:configure (§2a)
```

Buat API key global acak ≥ 32 karakter (mis. `openssl rand -hex 24`), samakan dengan `EVOLUTION_API_KEY` di `compose.prod.yml` env kontainer (`AUTHENTICATION_API_KEY`), lalu `docker compose up -d evolution` dan di sisi aplikasi `docker compose exec -T app php artisan config:cache`.

## 2a. Grup per perusahaan (Fase 1 multi-perusahaan)

Grup tujuan kini disimpan per perusahaan (`companies.settings.whatsapp.group_jid`, `docs/fitur/absensi-whatsapp.md` §3a). Saat deploy rilis Fase 1, migrasi menyalin `WHATSAPP_GROUP_JID` ke perusahaan pertama (SPKD) — tidak ada langkah manual. Periksa sesudah `migrate`:

```bash
docker compose exec -T app php artisan company:list          # kolom "Grup WhatsApp" SPKD terisi (tanpa "(.env)")
# bila kosong / ingin mengganti:
docker compose exec -T app php artisan company:configure <domain-spkd> --whatsapp-group=<…@g.us>
```

Perusahaan baru: undang nomor gateway ke grup manajemen perusahaan itu, ambil jid-nya (§3 langkah 4), lalu `company:configure <domain> --whatsapp-group=<jid>`. Tanpa itu absensi perusahaan tersebut tidak dikirim ke grup mana pun. `WHATSAPP_GROUP_JID` boleh tetap di `.env` (hanya dipakai bila hanya ada satu perusahaan).

## 3. Pasang nomor gateway (pairing, tanpa expose publik)

1. Tunnel SSH dari Mac: `ssh -L 8082:localhost:8082 root@187.77.118.216` — perlu port kontainer diteruskan: cukup `docker compose exec evolution true` tidak membuka UI; tambahkan sementara `ports: ["127.0.0.1:8082:8080"]` pada service `evolution`, `docker compose up -d evolution`.
2. Buka `http://localhost:8082/manager` → buat instance bernama `ruangkerja` → pindai QR dengan aplikasi WhatsApp di **nomor gateway**.
3. Masukkan nomor gateway ke grup manajemen (admin grup mengundangnya).
4. Ambil **group jid**: `curl -H "apikey: $EVOLUTION_API_KEY" http://localhost:8082/group/fetchAllGroups/ruangkerja` → salin `id` grup (`…@g.us`) lalu `php artisan company:configure <domain> --whatsapp-group=<jid>` (atau `WHATSAPP_GROUP_JID` untuk instalasi satu perusahaan).
5. Hapus port penerusan sementara, `docker compose up -d evolution`, `config:cache`.

## 4. Uji

```bash
docker compose exec -T app php artisan tinker
# >>> $wa = app(App\Domain\Notifications\Services\EvolutionWhatsApp::class);
# >>> $wa->sendText($wa->attendanceGroupFor(App\Models\Company::where('google_domain', '<domain>')->value('id')), 'tes absensi');
```

Pesan "tes absensi" harus muncul di grup. Uji lengkap: satu check-in nyata dengan rencana kerja.

## 5. Runbook

| Gejala | Periksa |
|---|---|
| Pesan tidak masuk grup | `docker compose logs evolution --tail 50`; instance status di manager (`open`?); grup perusahaan benar (`php artisan company:list`); log `whatsapp.attendance skipped` = perusahaan belum punya grup |
| Nomor terputus ( pairing kedaluwarsa / ponsel gateway ) | scan ulang QR (§3); sesi WhatsApp Web ponsel gateway jangan dihapus |
| Nomor diblokir WhatsApp | fitur mati sendiri (job gagal, log warning). Buat nomor gateway baru, pasang ulang, undang ke grup — tidak ada data hilang |
| Ingin mematikan sementara | `NOTIFICATIONS_WHATSAPP_ENABLED=false` + `config:cache` |
