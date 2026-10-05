<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Google\Actions\CreateDriveSubfolder;
use App\Domain\Google\Actions\LinkDriveFile;
use App\Domain\Workspaces\Actions\RefreshWorkspaceDrive;
use App\Domain\Workspaces\Queries\WorkspaceDriveListing;
use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Google\CreateDriveFolderRequest;
use App\Http\Requests\Google\LinkDriveFilesRequest;
use App\Models\DriveFile;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tab "File" (mockup WorkspaceFile / MFile): the workspace folder in the
 * Shared Drive, read from the drive_files cache and refreshed in the queue.
 */
class WorkspaceFileController extends Controller
{
    public function index(
        Request $request,
        Workspace $workspace,
        #[CurrentUser] User $user,
        WorkspacePage $page,
        WorkspaceDriveListing $listing,
        RefreshWorkspaceDrive $refresh,
    ): Response {
        Gate::authorize('view', $workspace);
        Gate::authorize('viewAny', [DriveFile::class, $workspace->id]);

        $folderId = $request->string('folder')->toString();
        $folder = $listing->resolveFolder($workspace, $folderId === '' ? null : $folderId);
        abort_if($folderId !== '' && $folder === null && $folderId !== $workspace->drive_folder_id, 404);

        $syncing = $refresh->handle($workspace, $folder?->google_file_id);
        $workspace->refresh();

        return Inertia::render('workspaces/files', [
            ...$page->props($workspace, $user),
            'drive' => $listing->drive($workspace, $user, $syncing),
            'folder' => $folder === null ? null : [
                'id' => $folder->google_file_id,
                'name' => $folder->name,
                'url' => $folder->web_view_link,
            ],
            'breadcrumbs' => $listing->breadcrumbs($workspace, $folder),
            'files' => $listing->files($workspace, $user, $folder),
        ]);
    }

    /**
     * "Muat ulang": re-reads the folder level from Drive (queued).
     */
    public function refresh(Request $request, Workspace $workspace, WorkspaceDriveListing $listing, RefreshWorkspaceDrive $refresh): RedirectResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('viewAny', [DriveFile::class, $workspace->id]);

        $folderId = $request->string('folder')->toString();
        $folder = $listing->resolveFolder($workspace, $folderId === '' ? null : $folderId);

        $refresh->handle($workspace, $folder?->google_file_id, force: true);

        return to_route('workspaces.files', ['workspace' => $workspace, 'folder' => $folder?->google_file_id]);
    }

    /**
     * "Folder baru": synchronous (10 s), then opens the new folder.
     */
    public function storeFolder(CreateDriveFolderRequest $request, Workspace $workspace, #[CurrentUser] User $user, WorkspaceDriveListing $listing, CreateDriveSubfolder $create): RedirectResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('create', [DriveFile::class, $workspace->id]);

        $parent = $listing->resolveFolder($workspace, $request->parent());
        abort_if($request->parent() !== null && $parent === null && $request->parent() !== $workspace->drive_folder_id, 404);

        $folder = $create->handle($workspace, $request->string('name')->toString(), $user, $parent?->google_file_id);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Folder {$folder->name} dibuat."]);

        return to_route('workspaces.files', ['workspace' => $workspace, 'folder' => $folder->google_file_id]);
    }

    /**
     * "Pilih dari Drive": records files picked with Google Picker.
     */
    public function link(LinkDriveFilesRequest $request, Workspace $workspace, #[CurrentUser] User $user, LinkDriveFile $link): RedirectResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('create', [DriveFile::class, $workspace->id]);

        $linked = 0;
        $elsewhere = 0;

        foreach ($request->fileIds() as $fileId) {
            $file = $link->handle($user, $workspace->id, $fileId);
            $file->workspace_id === $workspace->id ? $linked++ : $elsewhere++;
        }

        Inertia::flash('toast', $elsewhere === 0
            ? ['type' => 'success', 'message' => "{$linked} file ditautkan ke workspace ini."]
            : ['type' => 'warning', 'message' => "{$linked} file ditautkan. {$elsewhere} file sudah tercatat di workspace lain."]);

        return back();
    }
}
