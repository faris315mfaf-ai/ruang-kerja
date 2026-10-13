<?php

use App\Http\Controllers\Api\Projects\MilestoneController;
use App\Http\Controllers\Api\Projects\PortfolioController;
use App\Http\Controllers\Api\Projects\ProjectController;
use App\Http\Controllers\Api\Projects\ProjectRiskController;
use App\Http\Controllers\Api\Projects\ProjectSteeringController;
use App\Http\Controllers\Api\Projects\ProjectUpdateController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Bagian 5 / B5-A — Manajemen: portofolio, proyek, Dashboard Manajemen,
| catatan tindakan, OKR, monitoring Direksi (token Sanctum)
|--------------------------------------------------------------------------
|
| Dimuat di dalam grup v1 `auth:sanctum` (routes/api.php). Controller tipis di
| atas Query / Action / Policy web yang sama (PortfolioDashboard,
| ProjectSummary, PostProjectUpdate, SaveMilestone, SaveProjectRisk, …,
| ManagementDashboard, ManagementNotes, OkrIndex, ObjectiveDetail,
| RecordKeyResultCheckin, DailyWorkMonitor, WeeklyWorkMonitor,
| ProjectWorkMonitor, WorkspaceDirectory). "{workspace}" = binder web (key atau
| ULID, 404 bila tak terlihat). Detail laporan monitoring ada di
| b4c-laporan.php. Dokumen: docs/sesi/ponsel-b5a-manajemen.md.
*/

// --- Portofolio & proyek (PRD M10) ---
Route::get('portofolio', PortfolioController::class)->name('portfolio.index');

Route::prefix('proyek/{workspace}')->name('projects.')->scopeBindings()->group(function (): void {
    Route::get('/', [ProjectController::class, 'show'])->name('show');
    Route::get('update', [ProjectController::class, 'updates'])->name('updates.index');

    Route::post('update', [ProjectUpdateController::class, 'store'])->middleware('throttle:30,1')->name('updates.store');
    Route::post('update/{projectUpdate}/keputusan', [ProjectUpdateController::class, 'resolveDecision'])
        ->whereUlid('projectUpdate')->middleware('throttle:30,1')->name('updates.resolve-decision');
    Route::post('minta-update', [ProjectSteeringController::class, 'requestUpdate'])->middleware('throttle:30,1')->name('request-update');
    Route::post('arahan', [ProjectSteeringController::class, 'direct'])->middleware('throttle:30,1')->name('directions.store');

    Route::post('milestone', [MilestoneController::class, 'store'])->middleware('throttle:60,1')->name('milestones.store');
    Route::patch('milestone/{milestone}', [MilestoneController::class, 'update'])->whereUlid('milestone')->middleware('throttle:60,1')->name('milestones.update');
    Route::patch('milestone/{milestone}/selesai', [MilestoneController::class, 'complete'])->whereUlid('milestone')->middleware('throttle:60,1')->name('milestones.complete');
    Route::delete('milestone/{milestone}', [MilestoneController::class, 'destroy'])->whereUlid('milestone')->middleware('throttle:60,1')->name('milestones.destroy');

    Route::post('risiko', [ProjectRiskController::class, 'store'])->middleware('throttle:60,1')->name('risks.store');
    Route::patch('risiko/{risk}', [ProjectRiskController::class, 'update'])->whereUlid('risk')->middleware('throttle:60,1')->name('risks.update');
    Route::patch('risiko/{risk}/status', [ProjectRiskController::class, 'status'])->whereUlid('risk')->middleware('throttle:60,1')->name('risks.status');
    Route::delete('risiko/{risk}', [ProjectRiskController::class, 'destroy'])->whereUlid('risk')->middleware('throttle:60,1')->name('risks.destroy');
});
