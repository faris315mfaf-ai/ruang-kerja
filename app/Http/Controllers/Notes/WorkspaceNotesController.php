<?php

namespace App\Http\Controllers\Notes;

use App\Domain\Notes\Queries\NoteLibrary;
use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\NotePolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tab "Catatan" of a workspace (/w/{key}/catatan): the folder/note tree of
 * that workspace with "Folder baru" and "Catatan baru". In a personal
 * workspace only its owner gets here (WorkspacePolicy) and writes.
 */
class WorkspaceNotesController extends Controller
{
    public function show(Workspace $workspace, #[CurrentUser] User $user, WorkspacePage $page, NoteLibrary $library, NotePolicy $policy): Response
    {
        Gate::authorize('view', $workspace);

        return Inertia::render('workspaces/notes', [
            ...$page->props($workspace, $user),
            'notes' => [
                'viewer_id' => $user->id,
                'people' => $library->people($user),
                'notes' => $library->notes($user, $workspace->id),
                'can_create' => $policy->canCreateIn($user, $workspace),
            ],
        ]);
    }
}
