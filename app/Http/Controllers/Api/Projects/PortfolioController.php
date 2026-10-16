<?php

namespace App\Http\Controllers\Api\Projects;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Projects\Data\PortfolioFilters;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Queries\PortfolioDashboard;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/portofolio — the web /portofolio (PortfolioDashboard) as JSON
 * for the Android app (Bagian 5 / B5-A). Same Gate `viewPortfolio` (Direksi &
 * Super Admin with `portfolio.view`, Kepala Divisi; HR and staff → 403) and the
 * same scope (Workspace::portfolioFor): Direksi see every project and steer
 * them, a Kepala Divisi reads the projects involving their division ("Proyek
 * divisi", `mode: divisi`, no steering). The roadmap stays desktop-only.
 */
class PortfolioController extends Controller
{
    public function __invoke(Request $request, #[CurrentUser] User $user, PortfolioDashboard $dashboard): JsonResponse
    {
        Gate::authorize('viewPortfolio', Workspace::class);

        $period = $request->query('periode');
        $division = $request->query('divisi');
        $health = $request->query('status');

        $filters = new PortfolioFilters(
            period: is_string($period) && in_array($period, PortfolioFilters::PERIODS, true) ? $period : 'kuartal',
            divisionId: is_string($division) && strlen($division) === 26 ? strtolower($division) : null,
            health: is_string($health) ? ProjectHealth::tryFrom($health) : null,
            archive: $request->boolean('arsip'),
        );

        $data = $dashboard->build($user, $filters);
        unset($data['roadmap']);
        /** @var list<array<string, mixed>> $decisions */
        $decisions = $data['decisions'];
        /** @var array<string, mixed> $kpis */
        $kpis = $data['kpis'];

        return response()->json([
            'mode' => $user->hasPermission(Permission::PortfolioView) ? 'direksi' : 'divisi',
            ...$data,
            'kpis' => [...$kpis, 'decisions' => ['count' => count($decisions)]],
            'health_options' => array_map(fn (ProjectHealth $option): array => ['value' => $option->value, 'label' => $option->label()], ProjectHealth::cases()),
        ]);
    }
}
