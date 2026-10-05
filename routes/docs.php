<?php

use App\Http\Controllers\Admin\DocumentationController;
use Illuminate\Support\Facades\Route;

// Admin › Dokumentasi (Super Admin only; Gate `viewDocumentation`). The slug
// is looked up in the config/docs.php allowlist; it is never used as a path.
Route::middleware(['auth', 'verified'])
    ->prefix('admin/dokumentasi')
    ->name('admin.docs.')
    ->group(function () {
        Route::get('/', [DocumentationController::class, 'index'])->name('index');
        Route::get('{slug}', [DocumentationController::class, 'show'])
            ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*')
            ->name('show');
    });
