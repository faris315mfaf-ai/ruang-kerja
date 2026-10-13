<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Google\GoogleFeatures;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Queries\WorkspaceDriveListing;
use App\Domain\Workspaces\Queries\WorkspaceDriveStatus;
use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Models\Label;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/workspace/{workspace}/pengaturan — read-only settings (mockup
 * 19 "Pengaturan baca-saja + banner desktop"): general data, columns with
 * their task counts, labels, Drive folder and the abilities. Changing columns,
 * labels, key or visibility stays on the desktop (docs/PLATFORM.md §3), so
 * `edit_on_desktop` tells the app to show the "Buka di desktop" banner.
 */
class WorkspaceSettingsController extends Controller
{
    public function __invoke(Workspace $workspace, #[CurrentUser] User $user, WorkspacePage $page, WorkspaceDriveStatus $driveStatus): JsonResponse
    {
        Gate::authorize('view', $workspace);

        $can = $page->abilities($workspace, $user);

        return response()->json([
            'workspace' => [
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
                'previous_keys' => $workspace->previous_keys ?? [],
            ],
            'can' => $can,
            'edit_on_desktop' => $can['manage'],
            'statuses' => TaskStatus::query()
                ->where('workspace_id', $workspace->id)
                ->withCount('tasks')
                ->orderBy('position')
                ->get()
                ->map(fn (TaskStatus $status): array => [
                    'id' => $status->id,
                    'name' => $status->name,
                    'kategori' => $status->category->value,
                    'kategori_label' => $status->category->label(),
                    'color' => $status->color,
                    'posisi' => $status->position,
                    'tasks_count' => (int) ($status->getAttribute('tasks_count') ?? 0),
                ])
                ->values()
                ->all(),
            'labels' => Label::query()
                ->where('workspace_id', $workspace->id)
                ->withCount(['tasks' => fn (Builder $query) => $query->whereNotIn('status_category', TaskStatusCategory::closedValues())])
                ->orderBy('name')
                ->get()
                ->map(fn (Label $label): array => [
                    'id' => $label->id,
                    'name' => $label->name,
                    'color' => $label->color,
                    'tasks_count' => (int) ($label->getAttribute('tasks_count') ?? 0),
                ])
                ->values()
                ->all(),
            'drive' => [
                'enabled' => GoogleFeatures::enabled(),
                'folder_url' => $workspace->drive_folder_id === null ? null : WorkspaceDriveListing::folderUrl($workspace->drive_folder_id),
                'folder_name' => $workspace->driveFolderName(),
                'access' => $driveStatus->summary($workspace),
            ],
        ]);
    }
}
