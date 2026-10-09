<?php

use App\Http\Controllers\Android\AssetLinksController;
use Illuminate\Support\Facades\Route;

/*
| Identitas aplikasi Android (Digital Asset Links). `/.well-known/assetlinks.json`
| harus publik tanpa auth/CSRF agar Google Play bisa memverifikasi tautan
| aplikasi ↔ situs; tanpa sidik jari sertifikat endpoint balas `[]`, bukan 404.
*/

Route::get('.well-known/assetlinks.json', AssetLinksController::class)
    ->name('android.assetlinks');
