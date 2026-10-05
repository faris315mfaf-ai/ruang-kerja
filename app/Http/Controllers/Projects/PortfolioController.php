<?php

namespace App\Http\Controllers\Projects;

use App\Domain\Projects\Data\PortfolioFilters;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Queries\PortfolioDashboard;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /portofolio — Dashboard Direksi = portofolio proyek (Sprint 9).
 */
class PortfolioController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, PortfolioDashboard $dashboard): Response
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

        return Inertia::render('projects/portfolio', $dashboard->build($user, $filters));
    }
}
