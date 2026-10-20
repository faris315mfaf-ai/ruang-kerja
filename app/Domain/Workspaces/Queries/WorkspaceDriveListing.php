<?php

namespace App\Domain\Workspaces\Queries;

use App\Domain\Google\Enums\DriveFileKind;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Services\DriveUploadSessions;
use App\Domain\Tenancy\Settings\CompanySettings;
use App\Http\Resources\DriveFileResource;
use App\Models\Comment;
use App\Models\DriveFile;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Data of the File and Dokumen tabs, read from the drive_files cache
 * (never from Google during the request). Every list goes through
 * DriveFile::visibleTo($user) on top of the controller's authorization.
 */
final class WorkspaceDriveListing
{
    private const int MAX_BREADCRUMB_DEPTH = 20;

    public function __construct(private readonly WorkspaceDriveStatus $status) {}

    /**
     * Shared "drive" prop: availability, folder link, access summary, limits.
     *
     * @return array<string, mixed>
     */
    public function drive(Workspace $workspace, User $user, bool $syncing = false): array
    {
        return [
            'enabled' => GoogleFeatures::enabled($workspace->company_id),
            'fake' => GoogleFeatures::fake(),
            'picker_enabled' => GoogleFeatures::pickerEnabled(),
            // Env key names only, for the Super Admin (Pengaturan › Akun Google).
            'missing_settings' => $user->isSuperAdmin() ? GoogleFeatures::missingDriveSettings($workspace->company_id) : [],
            'folder_url' => $workspace->drive_folder_id === null ? null : self::folderUrl($workspace->drive_folder_id),
            'folder_name' => $workspace->driveFolderName(),
            'shared_drive_name' => CompanySettings::resolve()->sharedDriveName($workspace->company_id),
            'access' => $this->status->summary($workspace),
            'can_contribute' => Gate::forUser($user)->allows('create', [DriveFile::class, $workspace->id]),
            'max_upload_bytes' => GoogleFeatures::maxUploadBytes(),
            'chunk_bytes' => DriveUploadSessions::chunkBytes(),
            'syncing' => $syncing,
        ];
    }

    /**
     * The folder being browsed: the workspace root or one of its cached
     * sub-folders. Null when the id does not belong to this workspace.
     */
    public function resolveFolder(Workspace $workspace, ?string $folderId): ?DriveFile
    {
        if ($folderId === null || $folderId === $workspace->drive_folder_id) {
            return null;
        }

        return DriveFile::query()
            ->where('workspace_id', $workspace->id)
            ->where('google_file_id', $folderId)
            ->where('kind', DriveFileKind::Folder->value)
            ->first();
    }

    /**
     * Root first: [{id, name}] where id null = workspace root.
     *
     * @return list<array{id: string|null, name: string}>
     */
    public function breadcrumbs(Workspace $workspace, ?DriveFile $folder): array
    {
        $trail = [];
        $current = $folder;
        $seen = [];

        while ($current !== null && count($trail) < self::MAX_BREADCRUMB_DEPTH && ! isset($seen[$current->google_file_id])) {
            $seen[$current->google_file_id] = true;
            array_unshift($trail, ['id' => $current->google_file_id, 'name' => $current->name]);

            $parent = $current->parent_google_id;
            $current = $parent === null || $parent === $workspace->drive_folder_id ? null : DriveFile::query()
                ->where('workspace_id', $workspace->id)
                ->where('google_file_id', $parent)
                ->where('kind', DriveFileKind::Folder->value)
                ->first();
        }

        return [['id' => null, 'name' => $workspace->driveFolderName()], ...$trail];
    }

    /**
     * Children of a folder level; at the root also files linked with the
     * Picker that live elsewhere in Drive ("Ditautkan").
     *
     * @return list<array<string, mixed>>
     */
    public function files(Workspace $workspace, User $user, ?DriveFile $folder): array
    {
        $root = $workspace->drive_folder_id;
        $query = DriveFile::query()->visibleTo($user)->where('drive_files.workspace_id', $workspace->id);

        if ($folder !== null) {
            $query->inFolder($folder->google_file_id);
        } else {
            $knownFolders = DriveFile::query()
                ->where('workspace_id', $workspace->id)
                ->where('kind', DriveFileKind::Folder->value)
                ->pluck('google_file_id')
                ->all();
            $parents = array_values(array_filter([$root, ...$knownFolders]));

            // Root level = children of the root + files whose parent is not a
            // workspace folder (linked from elsewhere with the Picker).
            $query->when($parents !== [], fn (Builder $scoped) => $scoped->where(fn (Builder $level) => $level
                ->whereNull('drive_files.parent_google_id')
                ->orWhereNotIn('drive_files.parent_google_id', $parents)
                ->when($root !== null, fn (Builder $inRoot) => $inRoot->orWhere('drive_files.parent_google_id', $root))));
        }

        $files = $query->with('addedBy:id,name')
            ->orderByRaw("CASE WHEN drive_files.kind = 'folder' THEN 0 ELSE 1 END")
            ->orderBy('drive_files.name')
            ->limit(1000)
            ->get();

        return $this->rows($files, $user, $root, $workspace);
    }

    /**
     * Google Docs, Sheets and Slides anywhere in the workspace, newest first.
     *
     * @return list<array<string, mixed>>
     */
    public function documents(Workspace $workspace, User $user): array
    {
        $files = DriveFile::query()
            ->visibleTo($user)
            ->where('drive_files.workspace_id', $workspace->id)
            ->documents()
            ->with('addedBy:id,name')
            ->orderByDesc(DB::raw('COALESCE(drive_files.modified_at, drive_files.created_at)'))
            ->limit(500)
            ->get();

        return $this->rows($files, $user, $workspace->drive_folder_id, $workspace);
    }

    /**
     * Tab badges: "Dokumen 6", "File 24".
     *
     * @return array{documents: int, files: int}
     */
    public function counts(Workspace $workspace): array
    {
        $row = DB::table('drive_files')
            ->where('workspace_id', $workspace->id)
            ->whereNull('deleted_at')
            ->selectRaw("COUNT(*) FILTER (WHERE kind IN ('doc', 'sheet', 'slide')) AS documents")
            ->selectRaw("COUNT(*) FILTER (WHERE kind <> 'folder') AS files")
            ->first();

        return [
            'documents' => (int) ($row->documents ?? 0),
            'files' => (int) ($row->files ?? 0),
        ];
    }

    public static function folderUrl(string $folderId): string
    {
        return 'https://drive.google.com/drive/folders/'.rawurlencode($folderId);
    }

    /**
     * @param  iterable<DriveFile>  $files
     * @return list<array<string, mixed>>
     */
    private function rows(iterable $files, User $user, ?string $root, Workspace $workspace): array
    {
        $list = [];
        $ids = [];

        foreach ($files as $file) {
            $list[] = $file;
            $ids[] = $file->id;
        }

        $usedIn = $this->usedInTasks($ids, $user);
        $folders = DriveFile::query()
            ->where('workspace_id', $workspace->id)
            ->where('kind', DriveFileKind::Folder->value)
            ->pluck('google_file_id')
            ->all();
        $inWorkspace = array_flip(array_values(array_filter([$root, ...$folders])));
        $childCounts = $this->childCounts($workspace, $list);
        $owners = $this->ownerNames($list, $workspace);
        $rows = [];

        foreach ($list as $file) {
            $rows[] = (new DriveFileResource($file))->resolve() + [
                'parent_id' => $file->parent_google_id,
                'linked' => $file->parent_google_id === null || ! isset($inWorkspace[$file->parent_google_id]),
                'children_count' => $file->kind === DriveFileKind::Folder ? ($childCounts[$file->google_file_id] ?? 0) : null,
                // "Pemilik": who added it in RuangKerja, else the employee behind owner_email.
                'owner_name' => $file->addedBy->name ?? ($file->owner_email === null ? null : ($owners[strtolower($file->owner_email)] ?? null)),
                'used_in' => $usedIn[$file->id] ?? [],
            ];
        }

        return $rows;
    }

    /**
     * Tasks (visible to the user) that attach each file, directly or in one
     * of their (not deleted) comments: "PLQ-21" → /w/PLQ/tasks/21.
     *
     * @param  list<string>  $fileIds
     * @return array<string, list<array{key: string, title: string, url: string}>>
     */
    private function usedInTasks(array $fileIds, User $user): array
    {
        if ($fileIds === []) {
            return [];
        }

        $taskType = (new Task)->getMorphClass();
        $commentType = (new Comment)->getMorphClass();
        $visible = Workspace::query()->visibleTo($user)->select('workspaces.id');

        $direct = DB::table('attachments')
            ->where('attachments.attachable_type', $taskType)
            ->whereNull('attachments.deleted_at')
            ->whereIn('attachments.drive_file_id', $fileIds)
            ->select(['attachments.drive_file_id', 'attachments.attachable_id as task_id']);

        $viaComments = DB::table('attachments')
            ->join('comments', 'comments.id', '=', 'attachments.attachable_id')
            ->where('attachments.attachable_type', $commentType)
            ->where('comments.commentable_type', $taskType)
            ->whereNull('attachments.deleted_at')
            ->whereNull('comments.deleted_at')
            ->whereIn('attachments.drive_file_id', $fileIds)
            ->select(['attachments.drive_file_id', 'comments.commentable_id as task_id']);

        $rows = DB::query()
            ->fromSub($direct->union($viaComments), 'used')
            ->join('tasks', 'tasks.id', '=', 'used.task_id')
            ->join('workspaces', 'workspaces.id', '=', 'tasks.workspace_id')
            ->whereNull('tasks.deleted_at')
            ->whereIn('tasks.workspace_id', $visible)
            ->whereIn('tasks.id', Task::query()->respectingPrivacyOf($user)->select('tasks.id'))
            ->orderBy('tasks.number')
            ->get(['used.drive_file_id', 'tasks.number', 'tasks.title', 'workspaces.key']);

        $used = [];

        foreach ($rows as $row) {
            $key = $row->key.'-'.$row->number;
            $used[(string) $row->drive_file_id][] = [
                'key' => $key,
                'title' => (string) $row->title,
                'url' => '/w/'.$row->key.'/tasks/'.$row->number,
            ];
        }

        return $used;
    }

    /**
     * Employee names for the owner e-mails of the listed files (same company).
     *
     * @param  list<DriveFile>  $files
     * @return array<string, string> lower-case e-mail => name
     */
    private function ownerNames(array $files, Workspace $workspace): array
    {
        $emails = [];

        foreach ($files as $file) {
            if ($file->owner_email !== null && $file->added_by === null) {
                $emails[] = strtolower($file->owner_email);
            }
        }

        if ($emails === []) {
            return [];
        }

        $names = [];

        foreach (User::query()->where('company_id', $workspace->company_id)->whereIn(DB::raw('lower(email)'), array_values(array_unique($emails)))->get(['email', 'name']) as $user) {
            $names[strtolower($user->email)] = $user->name;
        }

        return $names;
    }

    /**
     * Cached children per folder ("9 file" on mobile).
     *
     * @param  list<DriveFile>  $files
     * @return array<string, int>
     */
    private function childCounts(Workspace $workspace, array $files): array
    {
        $folderIds = [];

        foreach ($files as $file) {
            if ($file->kind === DriveFileKind::Folder) {
                $folderIds[] = $file->google_file_id;
            }
        }

        if ($folderIds === []) {
            return [];
        }

        /** @var array<string, int> $counts */
        $counts = DB::table('drive_files')
            ->where('workspace_id', $workspace->id)
            ->whereNull('deleted_at')
            ->whereIn('parent_google_id', $folderIds)
            ->groupBy('parent_google_id')
            ->selectRaw('parent_google_id, COUNT(*) AS total')
            ->pluck('total', 'parent_google_id')
            ->map(fn (mixed $total): int => (int) $total)
            ->all();

        return $counts;
    }
}
