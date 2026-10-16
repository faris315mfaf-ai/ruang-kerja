<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Organization\Services\OrganizationTree;
use App\Http\Controllers\Controller;
use App\Models\Division;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Struktur organisasi for the Android app (nested list): the same
 * OrganizationTree data as the web page (Direksi → divisi → tim → orang,
 * name/position/avatar only). Not for staff: 404 (DivisionPolicy::viewChart,
 * keputusan pemilik 6 Okt 2026). The PNG export stays on the desktop
 * (keputusan pemilik Bagian 5): `png_export` is always false.
 */
class OrganizationChartController extends Controller
{
    public function __invoke(#[CurrentUser] User $viewer, OrganizationTree $tree): JsonResponse
    {
        Gate::authorize('viewChart', Division::class);

        return response()->json([
            'chart' => $tree->for($viewer),
            'can' => [
                'manage_employees' => $viewer->can('manage', User::class),
                'manage_organization' => $viewer->can('create', Division::class),
                'png_export' => false,
            ],
            'web_path' => '/organisasi/struktur',
        ]);
    }
}
