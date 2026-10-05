<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Google\Actions\CreateGoogleDoc;
use App\Domain\Workspaces\Actions\RefreshWorkspaceDrive;
use App\Domain\Workspaces\Queries\WorkspaceDriveListing;
use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Google\CreateDriveDocumentRequest;
use App\Http\Resources\DriveFileResource;
use App\Models\DriveFile;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tab "Dokumen": Docs/Sheets/Slides of the workspace + "Dokumen baru".
 */
class WorkspaceDocumentController extends Controller
{
    public function index(Workspace $workspace, #[CurrentUser] User $user, WorkspacePage $page, WorkspaceDriveListing $listing, RefreshWorkspaceDrive $refresh): Response
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('viewAny', [DriveFile::class, $workspace->id]);

        $syncing = $refresh->handle($workspace);
        $workspace->refresh();

        return Inertia::render('workspaces/documents', [
            ...$page->props($workspace, $user),
            'drive' => $listing->drive($workspace, $user, $syncing),
            'documents' => $listing->documents($workspace, $user),
        ]);
    }

    /**
     * Synchronous (10 s timeout): the browser opens `web_view_link` right away.
     * Also used by the File tab (with `folder`).
     */
    public function store(CreateDriveDocumentRequest $request, Workspace $workspace, #[CurrentUser] User $user, WorkspaceDriveListing $listing, CreateGoogleDoc $create): JsonResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('create', [DriveFile::class, $workspace->id]);

        $folder = $listing->resolveFolder($workspace, $request->folder());
        abort_if($request->folder() !== null && $folder === null && $request->folder() !== $workspace->drive_folder_id, 404);

        $file = $create->handle($workspace, $request->type(), $request->string('name')->toString(), $user, null, $folder?->google_file_id);
        $file->load('addedBy:id,name');

        return new JsonResponse([
            'file' => (new DriveFileResource($file))->resolve(),
            'message' => "{$request->type()->label()} {$file->name} dibuat.",
        ], 201);
    }
}
