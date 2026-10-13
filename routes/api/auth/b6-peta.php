<?php

use App\Http\Controllers\Api\Map\TileController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| B6 Peta riil di Absen — dimuat di dalam grup v1 `auth:sanctum`
|--------------------------------------------------------------------------
|
| Proxy ubin OpenStreetMap (`/peta/{z}/{x}/{y}`): zoom 14–18, di-cache di
| disk server 7 hari, User-Agent deskriptif dari config('services.osm').
| Satu kartu peta memuat belasan ubin sekaligus, jadi limiter umum `api-v1`
| (60/menit) diganti 600/menit per pengguna dengan kunci sendiri agar ubin
| tidak menghabiskan jatah endpoint lain. Dokumen: docs/sesi/ponsel-b6-peta.md.
*/

Route::get('peta/{z}/{x}/{y}', TileController::class)
    ->where(['z' => '[0-9]{1,2}', 'x' => '[0-9]{1,6}', 'y' => '[0-9]{1,6}'])
    ->withoutMiddleware('throttle:api-v1')
    ->middleware('throttle:600,1,peta')
    ->name('map.tile');
