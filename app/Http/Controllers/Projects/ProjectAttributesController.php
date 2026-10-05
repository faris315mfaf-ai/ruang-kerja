<?php

namespace App\Http\Controllers\Projects;

use App\Domain\Projects\Actions\UpdateProjectAttributes;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\ProjectAttributesRequest;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Pengaturan › Proyek (PIC, sponsor, divisi utama, tanggal, status).
 */
class ProjectAttributesController extends Controller
{
    public function update(ProjectAttributesRequest $request, Workspace $workspace, #[CurrentUser] User $user, UpdateProjectAttributes $action): RedirectResponse
    {
        Gate::authorize('update', $workspace);
        abort_unless($workspace->isProject(), 404);

        $action->handle($workspace, $user, $request->projectAttributes());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Atribut proyek disimpan.']);

        return back();
    }
}
