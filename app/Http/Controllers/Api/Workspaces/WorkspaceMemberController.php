<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Workspaces\Actions\AddWorkspaceMember;
use App\Domain\Workspaces\Actions\RemoveWorkspaceMember;
use App\Domain\Workspaces\Actions\UpdateWorkspaceMemberRole;
use App\Domain\Workspaces\Enums\DriveAccessStatus;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Queries\WorkspaceDriveStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspaces\WorkspaceMemberRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Policies\WorkspacePolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Members of a workspace for the mobile app (tab "Anggota" + the assignee
 * picker of the task form). Reading follows the web page (everyone who can
 * see the workspace; each row carries the "Akses Drive" state); add, change
 * role and remove run the web Actions behind WorkspacePolicy::manageMembers
 * (owner/admin, never an archived or personal workspace) and answer the same
 * Indonesian validation messages (422) as the web.
 */
class WorkspaceMemberController extends Controller
{
    public function __invoke(Workspace $workspace, #[CurrentUser] User $user, WorkspaceDriveStatus $driveStatus): JsonResponse
    {
        Gate::authorize('view', $workspace);

        $canManage = Gate::allows('manageMembers', $workspace);

        return response()->json([
            'anggota' => $this->rows($workspace, $driveStatus, $canManage, $user),
            'can' => ['manage_members' => $canManage],
            'role_options' => array_map(
                fn (WorkspaceRole $role): array => ['value' => $role->value, 'label' => $role->label()],
                WorkspaceRole::assignable(),
            ),
            'drive' => $driveStatus->summary($workspace),
        ]);
    }

    /**
     * Active employees who are not members yet (add-member picker); `?q=`
     * searches name and e-mail. Only for people who may manage members.
     */
    public function candidates(Request $request, Workspace $workspace): JsonResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('manageMembers', $workspace);

        $term = trim($request->string('q')->toString());

        $people = User::query()
            ->active()
            ->where('company_id', $workspace->company_id)
            ->whereNotIn('id', WorkspaceMember::query()->where('workspace_id', $workspace->id)->select('user_id'))
            ->when($term !== '', function (Builder $query) use ($term): void {
                $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($term)).'%';
                $query->where(fn (Builder $match) => $match
                    ->whereRaw('lower(name) like ?', [$like])
                    ->orWhereRaw('lower(email) like ?', [$like]));
            })
            ->with('division:id,name')
            ->orderBy('name')
            ->limit(30)
            ->get(['id', 'name', 'email', 'division_id', 'avatar_url']);

        return response()->json(['kandidat' => $people->map(fn (User $person): array => [
            'id' => $person->id,
            'name' => $person->name,
            'email' => $person->email,
            'avatar' => $person->avatar_url,
            'division' => $person->division?->name,
        ])->values()->all()]);
    }

    public function store(WorkspaceMemberRequest $request, Workspace $workspace, #[CurrentUser] User $user, AddWorkspaceMember $add, WorkspaceDriveStatus $driveStatus): JsonResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $member = User::query()->where('company_id', $workspace->company_id)->find($request->string('user_id')->toString());
        abort_if($member === null, 404);

        $add->handle($workspace, $user, $member, $request->role());

        return response()->json([
            'anggota' => $this->row($workspace, $member, $driveStatus),
            'message' => "{$member->name} ditambahkan sebagai {$request->role()->label()}.",
        ], 201);
    }

    public function update(WorkspaceMemberRequest $request, Workspace $workspace, User $member, #[CurrentUser] User $user, UpdateWorkspaceMemberRole $update, WorkspaceDriveStatus $driveStatus): JsonResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $update->handle($workspace, $user, $member, $request->role());

        return response()->json([
            'anggota' => $this->row($workspace, $member, $driveStatus),
            'message' => "Peran {$member->name} diubah menjadi {$request->role()->label()}.",
        ]);
    }

    public function destroy(Workspace $workspace, User $member, #[CurrentUser] User $user, RemoveWorkspaceMember $remove): JsonResponse
    {
        Gate::authorize('view', $workspace);
        Gate::authorize('manageMembers', $workspace);

        $remove->handle($workspace, $user, $member);

        return response()->json(['message' => "{$member->name} dikeluarkan dari workspace."]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function rows(Workspace $workspace, WorkspaceDriveStatus $driveStatus, bool $canManage, ?User $viewer = null): array
    {
        $drive = $driveStatus->members($workspace);
        // Penugasan HR (private tasks): non-admins only see HR and themselves.
        $hideOthers = $viewer !== null && ! app(WorkspacePolicy::class)->seesAllTasks($viewer, $workspace);

        return array_values(WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->when($hideOthers, fn (Builder $query) => $query->where(fn (Builder $own) => $own
                ->whereIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
                ->orWhere('user_id', $viewer?->id)))
            ->with(['user:id,name,avatar_url,division_id,position_id', 'user.division:id,name', 'user.position:id,name'])
            ->get()
            ->sortBy(fn (WorkspaceMember $member): string => (5 - $member->role->rank()).mb_strtolower($member->user->name))
            ->map(fn (WorkspaceMember $member): array => self::present($workspace, $member, $drive[$member->user_id] ?? null, $canManage))
            ->all());
    }

    /**
     * @return array<string, mixed>
     */
    private function row(Workspace $workspace, User $user, WorkspaceDriveStatus $driveStatus): array
    {
        $member = WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)
            ->with(['user:id,name,avatar_url,division_id,position_id', 'user.division:id,name', 'user.position:id,name'])
            ->firstOrFail();

        return self::present($workspace, $member, $driveStatus->members($workspace)[$user->id] ?? null, true);
    }

    /**
     * @param  array{status: string, label: string, error: string|null, synced_at: string|null}|null  $drive
     * @return array<string, mixed>
     */
    private static function present(Workspace $workspace, WorkspaceMember $member, ?array $drive, bool $canManage): array
    {
        $isOwner = $member->role === WorkspaceRole::Owner || $member->user_id === $workspace->owner_id;

        return [
            'id' => $member->user_id,
            'name' => $member->user->name,
            'avatar' => $member->user->avatar_url,
            'role' => $member->role->value,
            'role_label' => $member->role->label(),
            'is_synced' => $member->is_synced,
            'division' => $member->user->division?->name,
            'position' => $member->user->position?->name,
            'joined_at' => $member->joined_at?->toIso8601String(),
            'drive_access' => $drive === null ? null : [
                'status' => self::driveCode($drive['status']),
                'label' => $drive['label'],
                'error' => $drive['error'],
                'synced_at' => $drive['synced_at'],
            ],
            'can_change_role' => $canManage && ! $isOwner,
            'can_remove' => $canManage && ! $isOwner && ! $member->is_synced,
        ];
    }

    private static function driveCode(string $status): string
    {
        return match (DriveAccessStatus::tryFrom($status)) {
            DriveAccessStatus::Synced => 'tersinkron',
            DriveAccessStatus::Pending => 'menunggu',
            DriveAccessStatus::Error => 'gagal',
            DriveAccessStatus::Inactive => 'akun_nonaktif',
            DriveAccessStatus::Disabled => 'drive_belum_aktif',
            default => $status,
        };
    }
}
