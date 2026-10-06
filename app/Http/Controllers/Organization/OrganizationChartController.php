<?php

namespace App\Http\Controllers\Organization;

use App\Domain\Organization\Services\OrganizationTree;
use App\Http\Controllers\Controller;
use App\Models\Division;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Struktur organisasi: chart on desktop, nested list on mobile (docs/PLATFORM.md §3).
 * Not for staff: 404 (DivisionPolicy::viewChart, keputusan pemilik 6 Okt 2026).
 */
class OrganizationChartController extends Controller
{
    public function __invoke(#[CurrentUser] User $viewer, OrganizationTree $tree): Response
    {
        Gate::authorize('viewChart', Division::class);

        return Inertia::render('organization/structure', [
            'chart' => $tree->for($viewer),
            'can' => [
                'manageEmployees' => $viewer->can('manage', User::class),
                'manageOrganization' => $viewer->can('create', Division::class),
            ],
        ]);
    }
}
