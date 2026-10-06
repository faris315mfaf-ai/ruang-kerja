<?php

namespace App\Http\Controllers\Management;

use App\Domain\Analytics\Queries\ManagementDashboard;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Domain\Monitoring\Queries\ManagementNotes;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /manajemen — Dashboard Manajemen (design MgDashboard): company summary for
 * Direksi, HR and Super Admin (Gate `viewManagementDashboard`).
 *
 * The heavy blocks are deferred (skeleton first) and cached 5 minutes per
 * viewer. Keputusan pemilik 6 Okt 2026: "Beban kerja" (`workload`) and the
 * viewer's own "catatan tindakan" (`notes`, management_notes) live here. The
 * meeting & minutes module does not exist yet (PRD Fase 2): `agenda` and
 * `minutes` stay empty lists so the page shows its empty states.
 */
class DashboardController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, ManagementDashboard $dashboard, DashboardAccess $access, ManagementNotes $notes): Response
    {
        Gate::authorize('viewManagementDashboard');

        $now = CarbonImmutable::now();

        return Inertia::render('manajemen/dashboard', [
            ...$dashboard->header($user, $now),
            // "Semua proyek" links to the portfolio only for those who may open it (not HR).
            'can' => ['portfolio' => $access->canSeePortfolio($user)],
            'agenda' => [],
            'minutes' => [],
            'notes' => fn (): array => $notes->for($user, $now),
            'workload' => Inertia::defer(fn (): array => $dashboard->workload($user, CarbonImmutable::now()), 'workload'),
            'summary' => Inertia::defer(fn (): array => $dashboard->summary($user, CarbonImmutable::now()), 'summary'),
            'portfolio' => Inertia::defer(fn (): array => $dashboard->portfolio($user, CarbonImmutable::now()), 'portfolio'),
        ]);
    }
}
