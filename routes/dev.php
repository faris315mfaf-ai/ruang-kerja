<?php

use App\Http\Controllers\Dev\StyleGuideController;
use Illuminate\Support\Facades\Route;

// Living style guide of the Arus design system: local environment + Super Admin.
Route::middleware(['auth', 'verified'])
    ->get('dev/komponen', StyleGuideController::class)
    ->name('dev.components');
