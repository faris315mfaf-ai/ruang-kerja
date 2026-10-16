<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Google\Actions\CreateDriveSubfolder;
use App\Domain\Google\Actions\CreateGoogleDoc;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Notes\Queries\NoteLibrary;
use App\Domain\Workspaces\Actions\RefreshWorkspaceDrive;
use App\Domain\Workspaces\Queries\WorkspaceDriveListing;
use App\Http\Controllers\Controller;
use App\Http\Requests\Google\CreateDriveDocumentRequest;
use App\Http\Requests\Google\CreateDriveFolderRequest;
use App\Http\Resources\DriveFileResource;
use App\Models\DriveFile;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Tabs "Dokumen" and "File" of a workspace for the mobile app, read from the
 * drive_files cache (never from Google during the request) exactly like the
 * web tabs, plus the two Drive writes that need no upload session: "Dokumen
 * baru" (Docs/Sheets/Slides) and "Folder baru". Writes answer 503
 * `{code: drive_belum_siap, message}` while Google Drive is not configured;
 * uploads (chunked) are not exposed by the app API yet.
 */
class WorkspaceDriveController extends Controller
{
    public const string NOT_READY = 'drive_belum_siap';

    /**
     * Docs/Sheets/Slides + the note list of the workspace (link list to the
     * Catatan module; empty while `features.notes` is off).
     */
    public function documents(Workspace $workspace, #[CurrentUser] User $user, WorkspaceDriveListing $listing, RefreshWorkspaceDrive $refresh, NoteLibrary $library): JsonResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('viewAny', [DriveFile::class, $workspace->id]);

        $syncing = $refresh->handle($workspace);
        $workspace->refresh();

        return response()->json([
            'drive' => $listing->drive($workspace, $user, $syncing),
            'counts' => $listing->counts($workspace),
            'documents' => $listing->documents($workspace, $user),
            'notes' => config('features.notes') ? $this->notes($user, $workspace, $library) : [],
        ]);
    }

    /**
     * The workspace folder (or `?folder=` a cached sub-folder): breadcrumbs and
     * its children, folders first.
     */
    public function files(Request $request, Workspace $workspace, #[CurrentUser] User $user, WorkspaceDriveListing $listing, RefreshWorkspaceDrive $refresh): JsonResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('viewAny', [DriveFile::class, $workspace->id]);

        $folderId = $request->string('folder')->toString();
        $folder = $listing->resolveFolder($workspace, $folderId === '' ? null : $folderId);
        abort_if($folderId !== '' && $folder === null && $folderId !== $workspace->drive_folder_id, 404);

        $syncing = $refresh->handle($workspace, $folder?->google_file_id);
        $workspace->refresh();

        return response()->json([
            'drive' => $listing->drive($workspace, $user, $syncing),
            'counts' => $listing->counts($workspace),
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
     * POST /workspace/{workspace}/dokumen — synchronous create (10 s timeout
     * in the Google client), 201 with the cached file row.
     */
    public function storeDocument(CreateDriveDocumentRequest $request, Workspace $workspace, #[CurrentUser] User $user, WorkspaceDriveListing $listing, CreateGoogleDoc $create): JsonResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('create', [DriveFile::class, $workspace->id]);

        if ($notReady = $this->notReady()) {
            return $notReady;
        }

        $folder = $listing->resolveFolder($workspace, $request->folder());
        abort_if($request->folder() !== null && $folder === null && $request->folder() !== $workspace->drive_folder_id, 404);

        $file = $create->handle($workspace, $request->type(), $request->string('name')->toString(), $user, null, $folder?->google_file_id);
        $file->load('addedBy:id,name');

        return response()->json([
            'file' => (new DriveFileResource($file))->resolve(),
            'message' => "{$request->type()->label()} {$file->name} dibuat.",
        ], 201);
    }

    /**
     * POST /workspace/{workspace}/file/folder — "Folder baru".
     */
    public function storeFolder(CreateDriveFolderRequest $request, Workspace $workspace, #[CurrentUser] User $user, WorkspaceDriveListing $listing, CreateDriveSubfolder $create): JsonResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('create', [DriveFile::class, $workspace->id]);

        if ($notReady = $this->notReady()) {
            return $notReady;
        }

        $parent = $listing->resolveFolder($workspace, $request->parent());
        abort_if($request->parent() !== null && $parent === null && $request->parent() !== $workspace->drive_folder_id, 404);

        $folder = $create->handle($workspace, $request->string('name')->toString(), $user, $parent?->google_file_id);
        $folder->load('addedBy:id,name');

        return response()->json([
            'file' => (new DriveFileResource($folder))->resolve(),
            'message' => "Folder {$folder->name} dibuat.",
        ], 201);
    }

    private function notReady(): ?JsonResponse
    {
        if (GoogleFeatures::enabled()) {
            return null;
        }

        return response()->json([
            'code' => self::NOT_READY,
            'message' => GoogleFeatures::DISABLED_MESSAGE,
        ], 503);
    }

    /**
     * @return list<array{id: string, title: string, kind: string, parent_id: string|null, updated_at: string|null}>
     */
    private function notes(User $user, Workspace $workspace, NoteLibrary $library): array
    {
        return array_map(fn (array $note): array => [
            'id' => (string) $note['id'],
            'title' => (string) $note['title'],
            'kind' => (string) $note['kind'],
            'parent_id' => is_string($note['parent_id'] ?? null) ? $note['parent_id'] : null,
            'updated_at' => is_string($note['updated_at'] ?? null) ? $note['updated_at'] : null,
        ], $library->notes($user, $workspace->id));
    }
}
