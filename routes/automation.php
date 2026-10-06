<?php

use App\Http\Controllers\Automation\AutomationRuleController;
use App\Http\Controllers\Automation\PerformanceController;
use App\Http\Controllers\Automation\RecurringTaskController;
use App\Http\Controllers\Automation\TaskTemplateController;
use App\Http\Controllers\Automation\WorkspaceTemplateController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
 * Otomasi (aturan, tugas berulang, template) + Kinerja saya (Fase 2, F2-4;
 * docs/fitur/otomasi-whatsapp.md). Behind FEATURE_AUTOMATION
 * (config/features.php): 404 while off. Authorization: AutomationRulePolicy,
 * RecurringTaskPolicy, TaskTemplatePolicy, WorkspaceTemplatePolicy and the
 * `viewPerformance` gate (PerformancePolicy). WhatsApp settings stay a
 * preview in routes/prototype.php (held by the owner).
 */
Route::middleware([EnsureFeatureEnabled::class.':automation', 'auth', 'verified'])->group(function () {
    Route::prefix('otomasi')->name('automation.')->group(function () {
        Route::get('/', [AutomationRuleController::class, 'index'])->name('rules.index');
        Route::post('aturan', [AutomationRuleController::class, 'store'])->name('rules.store');
        Route::put('aturan/{rule}', [AutomationRuleController::class, 'update'])->whereUlid('rule')->name('rules.update');
        Route::patch('aturan/{rule}/aktif', [AutomationRuleController::class, 'active'])->whereUlid('rule')->name('rules.active');
        Route::post('aturan/{rule}/duplikat', [AutomationRuleController::class, 'duplicate'])->whereUlid('rule')->name('rules.duplicate');
        Route::delete('aturan/{rule}', [AutomationRuleController::class, 'destroy'])->whereUlid('rule')->name('rules.destroy');

        Route::get('berulang', [RecurringTaskController::class, 'index'])->name('recurring.index');
        Route::post('berulang', [RecurringTaskController::class, 'store'])->name('recurring.store');
        Route::put('berulang/{recurring}', [RecurringTaskController::class, 'update'])->whereUlid('recurring')->name('recurring.update');
        Route::patch('berulang/{recurring}/aktif', [RecurringTaskController::class, 'active'])->whereUlid('recurring')->name('recurring.active');
        Route::post('berulang/{recurring}/buat-sekarang', [RecurringTaskController::class, 'run'])->whereUlid('recurring')->name('recurring.run');
        Route::delete('berulang/{recurring}', [RecurringTaskController::class, 'destroy'])->whereUlid('recurring')->name('recurring.destroy');

        Route::get('template', [TaskTemplateController::class, 'index'])->name('templates.index');
        Route::post('template/tugas', [TaskTemplateController::class, 'store'])->name('templates.tasks.store');
        Route::put('template/tugas/{template}', [TaskTemplateController::class, 'update'])->whereUlid('template')->name('templates.tasks.update');
        Route::delete('template/tugas/{template}', [TaskTemplateController::class, 'destroy'])->whereUlid('template')->name('templates.tasks.destroy');
        Route::post('template/tugas/{template}/pakai', [TaskTemplateController::class, 'apply'])->whereUlid('template')->name('templates.tasks.apply');

        Route::post('template/workspace/dari/{workspace}', [WorkspaceTemplateController::class, 'store'])->whereUlid('workspace')->name('templates.workspaces.store');
        Route::post('template/workspace/{template}/pakai', [WorkspaceTemplateController::class, 'apply'])->whereUlid('template')->name('templates.workspaces.apply');
        Route::delete('template/workspace/{template}', [WorkspaceTemplateController::class, 'destroy'])->whereUlid('template')->name('templates.workspaces.destroy');
    });

    Route::get('kinerja', [PerformanceController::class, 'show'])->name('performance.show');
    Route::get('kinerja/{subject}', [PerformanceController::class, 'user'])->whereUlid('subject')->name('performance.user');
});
