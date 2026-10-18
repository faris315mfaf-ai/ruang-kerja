<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Automation\Actions\CreateWorkspaceFromTemplate;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceGroup;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Queries\LinkableTeams;
use App\Domain\Workspaces\Services\WorkspaceKeyGenerator;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\WorkspaceStoreRequest;
use App\Http\Resources\Api\WorkspaceSummary;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Workspace list of the mobile app: every workspace the caller may see (the
 * same Workspace::visibleTo as the web directory), grouped like the web —
 * Pribadi · Divisi & tim · Proyek yang diikuti · Lainnya (WorkspaceGroup,
 * keputusan pemilik 6 Okt 2026). All four groups are always present so the
 * client can render a stable tab layout. Items carry the badges of the
 * directory card (members, open and overdue tasks, my role, favorite);
 * favorites come first inside a group. `can_create` tells which "Workspace
 * baru" types the caller may start (WorkspacePolicy::create).
 */
class WorkspaceController extends Controller
{
    public function __invoke(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', Workspace::class);

        $today = CarbonImmutable::now(CurrentCompany::timezone())->toDateString();
        $closed = TaskStatusCategory::closedValues();

        $workspaces = Workspace::query()
            ->visibleTo($user)
            ->withMembershipOf($user)
            ->withCount([
                'memberships as members_count',
                'tasks as open_tasks_count' => fn (Builder $query) => $query->whereNotIn('status_category', $closed),
                'tasks as overdue_tasks_count' => fn (Builder $query) => $query->whereNotIn('status_category', $closed)->whereDate('due_date', '<', $today),
            ])
            ->orderBy('name')
            ->get()
            ->sortBy(fn (Workspace $workspace): string => $workspace->type->sortOrder()
                .($workspace->membership?->favorited_at === null ? '1' : '0'.$workspace->membership->favorited_at->format('YmdHis'))
                .mb_strtolower($workspace->name));

        $seesAll = Workspace::seesAllShared($user);

        $groups = [];
        foreach (WorkspaceGroup::cases() as $group) {
            $groups[$group->value] = ['jenis' => $group->value, 'label' => $group->label(), 'items' => []];
        }

        foreach ($workspaces as $workspace) {
            $item = WorkspaceSummary::item($workspace, $user, $seesAll);
            $groups[$item['group']]['items'][] = $item;
        }

        return response()->json([
            'groups' => array_values($groups),
            'can_create' => [
                'team' => Gate::allows('create', [Workspace::class, WorkspaceType::Team]),
                'project' => Gate::allows('create', [Workspace::class, WorkspaceType::Project]),
            ],
            'teams' => app(LinkableTeams::class)->for($user),
        ]);
    }

    /**
     * POST /api/v1/workspace — "Workspace baru" (sheet 15): the web
     * CreateWorkspace behind WorkspacePolicy::create(type), or
     * CreateWorkspaceFromTemplate (behind features.automation, like the web
     * template pages) when `template_id` is given. 201 with the new row.
     */
    public function store(WorkspaceStoreRequest $request, #[CurrentUser] User $user, CreateWorkspace $createWorkspace, CreateWorkspaceFromTemplate $fromTemplate): JsonResponse
    {
        if ($request->templateId() !== null) {
            abort_unless((bool) config('features.automation'), 404);

            $template = WorkspaceTemplate::query()
                ->where('company_id', $user->company_id)
                ->find($request->templateId());
            abort_if($template === null, 404);

            Gate::authorize('use', $template);

            $key = $request->keyOrNull()
                ?? app(WorkspaceKeyGenerator::class)->generate((string) $user->company_id, $request->string('name')->toString());

            $workspace = $fromTemplate->handle($template, $user, [
                'name' => $request->string('name')->trim()->toString(),
                'key' => $key,
                'visibility' => $request->visibility(),
                'description' => $request->descriptionOrNull(),
            ]);
        } else {
            $type = $request->type();
            abort_if($type === null, 422);

            Gate::authorize('create', [Workspace::class, $type]);

            $teamId = $type === WorkspaceType::Team && $request->teamId() !== null
                && in_array($request->teamId(), array_column(app(LinkableTeams::class)->for($user), 'id'), true)
                    ? $request->teamId()
                    : null;

            $workspace = $createWorkspace->handle($user, [
                'type' => $type,
                'name' => $request->string('name')->trim()->toString(),
                'key' => $request->keyOrNull(),
                'description' => $request->descriptionOrNull(),
                'visibility' => $request->visibility(),
                'team_id' => $teamId,
            ]);
        }

        $workspace = Workspace::query()
            ->whereKey($workspace->id)
            ->withMembershipOf($user)
            ->withCount(['memberships as members_count'])
            ->firstOrFail();

        return response()->json([
            'workspace' => WorkspaceSummary::item($workspace, $user, Workspace::seesAllShared($user)),
            'message' => "Workspace {$workspace->name} dibuat.",
        ], 201);
    }
}
