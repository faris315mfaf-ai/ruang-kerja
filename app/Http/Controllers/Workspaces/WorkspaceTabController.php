<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tab "Aktivitas". ("Dokumen" and "File" live in WorkspaceDocumentController
 * and WorkspaceFileController, Sprint 7.)
 */
class WorkspaceTabController extends Controller
{
    public function activity(Workspace $workspace, #[CurrentUser] User $user, WorkspacePage $page): Response
    {
        Gate::authorize('view', $workspace);

        $activities = Activity::query()
            ->where('workspace_id', $workspace->id)
            ->respectingPrivacyOf($user)
            ->with('causer:id,name,avatar_url')
            ->latest('created_at')
            ->latest('id')
            ->paginate(50)
            ->withQueryString();

        return Inertia::render('workspaces/activity', [
            ...$page->props($workspace, $user),
            'activities' => [
                'data' => $activities->getCollection()->map(fn (Activity $activity): array => [
                    'id' => $activity->id,
                    'event' => $activity->event,
                    'properties' => $activity->properties ?? [],
                    'subject_id' => $activity->subject_id,
                    'created_at' => $activity->created_at->toIso8601String(),
                    'causer' => $activity->causer === null ? null : [
                        'id' => $activity->causer->id,
                        'name' => $activity->causer->name,
                        'avatar' => $activity->causer->avatar_url,
                    ],
                ])->values()->all(),
                'next_page_url' => $activities->nextPageUrl(),
                'prev_page_url' => $activities->previousPageUrl(),
                'current_page' => $activities->currentPage(),
            ],
        ]);
    }
}
