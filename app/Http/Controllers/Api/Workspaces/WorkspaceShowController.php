<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Google\GoogleFeatures;
use App\Domain\Projects\Queries\ProjectMetrics;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Domain\Workspaces\Queries\WorkspaceDriveListing;
use App\Domain\Workspaces\Queries\WorkspaceDriveStatus;
use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\WorkspaceAccess;
use App\Models\DriveFile;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Policies\WorkspacePolicy;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/workspace/{workspace} — header of a workspace screen: identity,
 * my role, the read-only banner state, abilities (WorkspacePage::abilities =
 * the web `can`), counts for the tab badges and the tabs the app may show.
 * Only workspaces visible to the caller resolve (404 otherwise).
 */
class WorkspaceShowController extends Controller
{
    public function __invoke(
        Workspace $workspace,
        #[CurrentUser] User $user,
        WorkspacePage $page,
        WorkspacePolicy $policy,
        WorkspaceDriveListing $drive,
        WorkspaceDriveStatus $driveStatus,
    ): JsonResponse {
        Gate::authorize('view', $workspace);

        $today = CarbonImmutable::now(CurrentCompany::timezone())->toDateString();
        $open = Task::query()->where('workspace_id', $workspace->id)->whereNotIn('status_category', TaskStatusCategory::closedValues());
        $counts = $drive->counts($workspace);
        $membership = WorkspaceMember::query()->where('workspace_id', $workspace->id)->where('user_id', $user->id)->first();
        $role = $workspace->isPersonal() ? ($workspace->owner_id === $user->id ? 'owner' : null) : $membership?->role->value;
        $notes = (bool) config('features.notes');

        $detail = [
            'id' => $workspace->id,
            'key' => $workspace->key,
            'name' => $workspace->name,
            'type' => $workspace->type->value,
            'type_label' => $workspace->type->label(),
            'color' => $workspace->color ?? 'gray',
            'description' => $workspace->description,
            'visibility' => $workspace->visibility->value,
            'owner_id' => $workspace->owner_id,
            'arsip' => $workspace->isArchived(),
            'archived_at' => $workspace->archived_at?->toIso8601String(),
            'drive_folder_url' => $workspace->drive_folder_id === null ? null : WorkspaceDriveListing::folderUrl($workspace->drive_folder_id),
        ];

        return response()->json([
            'workspace' => $detail,
            'my_role' => $role,
            'favorit' => $membership?->favorited_at !== null,
            'read_only' => WorkspaceAccess::readOnly($workspace, $user, $policy),
            'can' => $page->abilities($workspace, $user) + [
                'contribute_drive' => GoogleFeatures::enabled() && Gate::allows('create', [DriveFile::class, $workspace->id]),
            ],
            'counts' => [
                'members' => $workspace->memberships()->count(),
                'open_tasks' => (clone $open)->count(),
                'overdue_tasks' => (clone $open)->whereDate('due_date', '<', $today)->count(),
                'columns' => $workspace->statuses()->count(),
                'documents' => $counts['documents'],
                'files' => $counts['files'],
            ],
            'drive' => [
                'enabled' => GoogleFeatures::enabled(),
                'access' => $driveStatus->summary($workspace),
            ],
            'project' => $workspace->isProject() ? [
                'status' => ProjectMetrics::status($workspace)->value,
                'status_label' => ProjectMetrics::status($workspace)->label(),
                'health' => $workspace->health?->value,
                'health_label' => $workspace->health?->label(),
                'start_date' => $workspace->start_date?->toDateString(),
                'target_date' => $workspace->target_date?->toDateString(),
                'lead_user_id' => $workspace->lead_user_id,
                'last_update_at' => $workspace->last_update_at?->toIso8601String(),
            ] : null,
            'tabs' => array_values(array_filter([
                'tugas',
                'dokumen',
                'file',
                'aktivitas',
                'anggota',
                $notes ? 'catatan' : null,
                $workspace->isProject() ? 'ringkasan' : null,
                'pengaturan',
            ])),
        ]);
    }
}
