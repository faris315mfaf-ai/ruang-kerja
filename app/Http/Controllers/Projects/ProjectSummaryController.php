<?php

namespace App\Http\Controllers\Projects;

use App\Domain\Projects\Queries\ProjectSummary;
use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tab "Ringkasan" of a project workspace (/w/{KEY}/ringkasan).
 */
class ProjectSummaryController extends Controller
{
    public function show(Workspace $workspace, #[CurrentUser] User $user, WorkspacePage $page, ProjectSummary $summary): Response
    {
        Gate::authorize('view', $workspace);
        abort_unless($workspace->isProject(), 404);

        return Inertia::render('workspaces/summary', [
            ...$page->props($workspace, $user),
            ...$summary->build($workspace, $user),
        ]);
    }
}
