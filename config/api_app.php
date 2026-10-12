<?php

/*
|--------------------------------------------------------------------------
| Konfigurasi aplikasi ponsel (GET /api/v1/konfigurasi)
|--------------------------------------------------------------------------
|
| Dibaca aplikasi Android saat dibuka (tanpa login) untuk menentukan apakah
| versinya masih didukung dan apakah server sedang dalam pemeliharaan.
| Nilai berasal dari environment — ubah `.env` lalu `php artisan config:clear`.
|
| - min_version: klien yang mengirim header `X-App-Version` di bawah nilai ini
|   dijawab 426 `update_required` di semua rute /api/v1 (kecuali konfigurasi).
| - latest_version: versi terbaru yang tersedia (anjuran memperbarui, bukan wajib).
| - maintenance: bila `active`, semua rute /api/v1 kecuali konfigurasi dijawab
|   503 `maintenance` dengan `message` apa adanya.
|
*/

return [

    'min_version' => (string) env('APP_MIN_VERSION', '1.0.0'),

    'latest_version' => (string) env('APP_LATEST_VERSION', '1.0.0'),

    'maintenance' => [
        'active' => (bool) env('APP_MAINTENANCE_API', false),
        'message' => (string) env('APP_MAINTENANCE_MESSAGE', 'RuangKerja sedang dalam pemeliharaan. Coba lagi beberapa saat lagi.'),
    ],

];
