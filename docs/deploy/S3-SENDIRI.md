# S3 sendiri: penyimpanan file di VPS terpisah

S3 di RuangKerja **bukan database**. S3 menyimpan file, dan database PostgreSQL tetap di server aplikasi. Isinya:

| Bucket | Isi | Ditulis oleh |
|---|---|---|
| `ruangkerja-private` | foto selfie absensi (`selfies/…`), lampiran pengajuan (surat dokter, nota) | aplikasi (identitas `ruangkerja-app`) |
| `ruangkerja-backup` | dump PostgreSQL harian (`postgres/…`) | kontainer `backup` (identitas `ruangkerja-backup`) |

Alasannya: tanpa S3, file-file ini ada di disk server aplikasi dan **tidak ikut** di backup database. Bila server rusak, file hilang. Dengan S3 di VPS lain, file dan backup tetap selamat.

Perangkat lunak: **SeaweedFS** (Apache-2.0, satu server cukup), versi dipatok `4.48`. MinIO edisi gratis tidak dipakai karena image Docker-nya tidak dirilis lagi sejak Okt 2025 dan repo-nya diarsipkan April 2026.

Berkas: `compose.storage.yml`, `docker/caddy/Caddyfile.storage`, `docker/seaweedfs/s3.json.example`.

## 1. Spesifikasi VPS S3

| Kebutuhan | Nilai awal |
|---|---|
| CPU / RAM | 2 vCPU / 2–4 GB |
| Disk | **Besar & aman**: 200 GB+ (selfie ±100–300 KB × karyawan × hari kerja, dihapus otomatis setelah 12 bulan; backup 30 hari) |
| Jaringan | IP publik, domain `s3.<domain-kantor>` mengarah ke IP ini |
| Lokasi | Sebaiknya penyedia/pusat data **berbeda** dari server aplikasi, supaya satu gangguan tidak menghilangkan keduanya |

## 2. Pasang (sekali)

Di VPS S3, direktori `/opt/ruangkerja-storage`:

1. Pasang Docker dan salin tiga berkas di atas (dengan foldernya).
2. Buat kunci acak untuk dua identitas:
   ```bash
   openssl rand -hex 16   # access key
   openssl rand -hex 32   # secret key
   ```
3. Salin templat identitas, isi dengan kunci tadi, lalu batasi aksesnya:
   ```bash
   cp docker/seaweedfs/s3.json.example docker/seaweedfs/s3.json
   chmod 600 docker/seaweedfs/s3.json
   ```
   Berkas `s3.json` di-ignore git, jangan di-commit.
4. Buat `.env` berisi `S3_DOMAIN=s3.<domain-kantor>` dan `ACME_EMAIL=<email>`.
5. Jalankan:
   ```bash
   docker compose -f compose.storage.yml up -d --wait
   ```
   Caddy mengambil sertifikat HTTPS otomatis.
6. Buat dua bucket:
   ```bash
   echo "s3.bucket.create -name ruangkerja-private" | docker compose -f compose.storage.yml exec -T seaweedfs weed shell
   echo "s3.bucket.create -name ruangkerja-backup"  | docker compose -f compose.storage.yml exec -T seaweedfs weed shell
   ```
7. **Firewall** (UFW atau panel penyedia): port 443 dan 80 hanya dari **IP publik server aplikasi** (80 dibuka sementara untuk sertifikat Let's Encrypt). Selain itu hanya SSH.
   - Selfie dan lampiran dialirkan lewat aplikasi (rute bertanda tangan + Policy), jadi browser karyawan tidak pernah mengakses S3 langsung.

## 3. Sambungkan aplikasi

Di `.env` server aplikasi:

```dotenv
ATTENDANCE_SELFIE_DRIVER=s3
REQUEST_ATTACHMENT_DISK=s3
AWS_ACCESS_KEY_ID=<access key ruangkerja-app>
AWS_SECRET_ACCESS_KEY=<secret key ruangkerja-app>
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=ruangkerja-private
AWS_ENDPOINT=https://s3.<domain-kantor>
AWS_USE_PATH_STYLE_ENDPOINT=true

BACKUP_S3_PROVIDER=Other
BACKUP_S3_ENDPOINT=https://s3.<domain-kantor>
BACKUP_S3_REGION=us-east-1
BACKUP_S3_ACCESS_KEY_ID=<access key ruangkerja-backup>
BACKUP_S3_SECRET_ACCESS_KEY=<secret key ruangkerja-backup>
BACKUP_REMOTE=backup:ruangkerja-backup/postgres
```

`FILESYSTEM_DISK` tetap `local`, karena berkas sementara (unggahan Drive, impor karyawan) memang di disk server. Setelah mengubah `.env`, jalankan `docker compose up -d` agar kontainer membaca ulang konfigurasi.

## 4. Cek

```bash
docker compose exec -T app php artisan tinker --execute 'Storage::disk("selfies")->put("cek.txt","ok"); echo Storage::disk("selfies")->get("cek.txt"); Storage::disk("selfies")->delete("cek.txt");'
docker compose exec -T backup backup.sh   # satu backup manual, lalu periksa di bucket ruangkerja-backup
```

Uji lokal (6–7 Okt 2026, SeaweedFS 4.48): disk `selfies` dan lampiran pengajuan bisa tulis, baca, dan hapus. Kunci aplikasi **ditolak** menulis ke bucket backup, dan kunci backup ditolak membaca bucket aplikasi. rclone (dipakai kontainer backup) berhasil mengunggah dump ke `ruangkerja-backup`.

## 5. Memindahkan file lama

Bila sebelumnya selfie dan lampiran tersimpan di disk server (`local`), salin ke S3 **sebelum** mengganti `.env`, lalu ganti `.env`:

```bash
docker run --rm -v ruangkerja_storage:/s:ro \
  -e RCLONE_CONFIG_S3_TYPE=s3 -e RCLONE_CONFIG_S3_PROVIDER=Other \
  -e RCLONE_CONFIG_S3_ENDPOINT=https://s3.<domain-kantor> \
  -e RCLONE_CONFIG_S3_ACCESS_KEY_ID=<app key> -e RCLONE_CONFIG_S3_SECRET_ACCESS_KEY=<app secret> \
  -e RCLONE_CONFIG_S3_FORCE_PATH_STYLE=true \
  rclone/rclone copy /s/app/private/selfies s3:ruangkerja-private/selfies
```

Lampiran pengajuan: ulangi perintah yang sama dengan `copy /s/app/private/request-attachments s3:ruangkerja-private/request-attachments` (path di bucket sama dengan path di disk lama).

## 6. Perawatan

- Disk VPS S3 dipantau. Selfie lama dihapus otomatis oleh aplikasi (`attendance:purge-selfies`), backup lama oleh kontainer backup (`BACKUP_RETENTION_DAYS`).
- Isi volume `seaweed` adalah data penting. Aktifkan snapshot/backup disk dari penyedia VPS S3 bila tersedia.
- Naikkan versi SeaweedFS dengan mengubah `SEAWEEDFS_TAG` setelah membaca catatan rilisnya.
