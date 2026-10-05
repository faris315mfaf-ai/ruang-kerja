<?php

use App\Http\Controllers\Projects\MilestoneController;
use App\Http\Controllers\Projects\PortfolioController;
use App\Http\Controllers\Projects\ProjectAttributesController;
use App\Http\Controllers\Projects\ProjectRiskController;
use App\Http\Controllers\Projects\ProjectSteeringController;
use App\Http\Controllers\Projects\ProjectSummaryController;
use App\Http\Controllers\Projects\ProjectUpdateController;
use Illuminate\Support\Facades\Route;

/*
| Projects & portfolio (Sprint 9, PRD M10). Uses the `workspace` binding of
| routes/workspaces.php (key in the URL, scoped child bindings).
*/
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('portofolio', [PortfolioController::class, 'index'])->name('portfolio.index');

    Route::prefix('w/{workspace}')->scopeBindings()->group(function () {
        Route::get('ringkasan', [ProjectSummaryController::class, 'show'])->name('projects.summary');
        Route::patch('proyek', [ProjectAttributesController::class, 'update'])->name('projects.attributes.update');

        Route::post('update-proyek', [ProjectUpdateController::class, 'store'])->name('projects.updates.store');
        Route::post('update-proyek/{projectUpdate}/keputusan', [ProjectUpdateController::class, 'resolveDecision'])->name('projects.updates.resolve-decision');
        Route::post('minta-update', [ProjectSteeringController::class, 'requestUpdate'])->name('projects.request-update');
        Route::post('arahan', [ProjectSteeringController::class, 'direct'])->name('projects.directions.store');

        Route::post('milestone', [MilestoneController::class, 'store'])->name('projects.milestones.store');
        Route::patch('milestone/{milestone}', [MilestoneController::class, 'update'])->name('projects.milestones.update');
        Route::patch('milestone/{milestone}/selesai', [MilestoneController::class, 'complete'])->name('projects.milestones.complete');
        Route::delete('milestone/{milestone}', [MilestoneController::class, 'destroy'])->name('projects.milestones.destroy');

        Route::post('risiko', [ProjectRiskController::class, 'store'])->name('projects.risks.store');
        Route::patch('risiko/{risk}', [ProjectRiskController::class, 'update'])->name('projects.risks.update');
        Route::delete('risiko/{risk}', [ProjectRiskController::class, 'destroy'])->name('projects.risks.destroy');
    });
});
