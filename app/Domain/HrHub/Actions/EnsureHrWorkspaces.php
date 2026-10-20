<?php

namespace App\Domain\HrHub\Actions;

use App\Domain\HrHub\Enums\SystemWorkspace;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\RemovedMembersCleanup;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Ruang HR system workspaces of one company (keputusan pemilik 20 Okt 2026):
 * "Tim HR" (shared notes) and "Penugasan HR" (tasks for employees, private
 * tasks). Finds or creates both under a company row lock and keeps their
 * owner/admin rows in line with the global roles: every active `hr` and
 * `super_admin` is a synced admin, the owner is the first active HR (else
 * the first Super Admin). Manually added members (task recipients) are never
 * removed; a non-HR owner/admin row is demoted to member.
 *
 * Cheap when already in sync (three reads, no writes), so Ruang HR calls it
 * on every page; a daily per-company task repairs drift too.
 */
final class EnsureHrWorkspaces
{
    public function __construct(
        private readonly CreateWorkspace $createWorkspace,
        private readonly RemovedMembersCleanup $cleanup,
    ) {}

    /**
     * @return array<string, Workspace> keyed by SystemWorkspace value; empty when
     *                                  the company has no active HR nor Super Admin
     */
    public function handle(Company|string $company): array
    {
        $companyId = $company instanceof Company ? $company->id : $company;
        $desired = $this->desiredAdmins($companyId);

        if ($desired === []) {
            return $this->existing($companyId);
        }

        $existing = $this->existing($companyId);

        if (count($existing) === count(SystemWorkspace::cases()) && $this->inSync($existing, $desired)) {
            return $existing;
        }

        return DB::transaction(function () use ($companyId, $desired): array {
            Company::query()->whereKey($companyId)->lockForUpdate()->first(['id']);

            $workspaces = $this->existing($companyId);
            $ownerId = array_key_first($desired);
            $owner = User::query()->findOrFail($ownerId);

            foreach (SystemWorkspace::cases() as $system) {
                $workspace = $workspaces[$system->value] ?? $this->createWorkspace->handle($owner, [
                    'type' => WorkspaceType::Team,
                    'name' => $system->label(),
                    'key' => $system->keyPrefix(),
                    'description' => $system->description(),
                    'visibility' => WorkspaceVisibility::Private,
                    'color' => $system->color(),
                    'system_key' => $system,
                ]);

                if (! array_key_exists($workspace->owner_id, $desired)) {
                    $workspace->owner_id = $ownerId;
                    $workspace->save();
                }

                $this->syncAdmins($workspace, $desired);
                $workspaces[$system->value] = $workspace;
            }

            return $workspaces;
        });
    }

    /**
     * Active HR first (the owner is the first of them), then Super Admins.
     *
     * @return array<string, true> user id => true, ordered
     */
    private function desiredAdmins(string $companyId): array
    {
        $users = User::query()
            ->active()
            ->where('company_id', $companyId)
            ->whereHas('roles', fn (Builder $roles) => $roles->whereIn('name', [Role::Hr->value, Role::SuperAdmin->value]))
            ->withExists(['roles as is_hr' => fn (Builder $roles) => $roles->where('name', Role::Hr->value)])
            ->orderBy('id')
            ->get(['id']);

        $ordered = $users->sortBy(fn (User $user): int => $user->getAttribute('is_hr') ? 0 : 1, SORT_REGULAR, false);

        return array_fill_keys(array_map('strval', $ordered->pluck('id')->all()), true);
    }

    /**
     * @return array<string, Workspace>
     */
    private function existing(string $companyId): array
    {
        $workspaces = [];

        foreach (Workspace::withTrashed()->where('company_id', $companyId)->whereNotNull('system_key')->get() as $workspace) {
            if ($workspace->trashed()) {
                $workspace->restore();
            }

            if ($workspace->system_key !== null) {
                $workspaces[$workspace->system_key->value] = $workspace;
            }
        }

        return $workspaces;
    }

    /**
     * @param  array<string, Workspace>  $workspaces
     * @param  array<string, true>  $desired
     */
    private function inSync(array $workspaces, array $desired): bool
    {
        $rows = WorkspaceMember::query()
            ->whereIn('workspace_id', array_map(fn (Workspace $workspace): string => $workspace->id, array_values($workspaces)))
            ->get(['workspace_id', 'user_id', 'role', 'is_synced'])
            ->groupBy('workspace_id');

        foreach ($workspaces as $workspace) {
            if (! array_key_exists($workspace->owner_id, $desired) || $workspace->isArchived()) {
                return false;
            }

            /** @var array<string, WorkspaceMember> $members */
            $members = ($rows[$workspace->id] ?? collect())->keyBy('user_id')->all();

            foreach (array_keys($desired) as $userId) {
                $row = $members[$userId] ?? null;

                if ($row === null || $row->role !== self::roleFor($workspace, $userId) || ! $row->is_synced) {
                    return false;
                }
            }

            foreach ($members as $userId => $row) {
                if (! isset($desired[$userId]) && ($row->is_synced || $row->role->canManage())) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @param  array<string, true>  $desired
     */
    private function syncAdmins(Workspace $workspace, array $desired): void
    {
        if ($workspace->isArchived()) {
            $workspace->forceFill(['archived_at' => null])->save();
        }

        /** @var array<string, WorkspaceMember> $existing */
        $existing = WorkspaceMember::query()->where('workspace_id', $workspace->id)->get()->keyBy('user_id')->all();
        $now = now();
        $added = [];
        $removed = [];
        $changed = false;

        foreach (array_keys($desired) as $userId) {
            $role = self::roleFor($workspace, $userId);
            $row = $existing[$userId] ?? null;

            if ($row === null) {
                WorkspaceMember::query()->insert([
                    'workspace_id' => $workspace->id,
                    'user_id' => $userId,
                    'role' => $role->value,
                    'is_synced' => true,
                    'joined_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $added[] = $userId;

                continue;
            }

            if ($row->role !== $role || ! $row->is_synced) {
                $this->update($workspace, $userId, ['role' => $role->value, 'is_synced' => true]);
                $changed = true;
            }
        }

        foreach ($existing as $userId => $row) {
            if (isset($desired[$userId])) {
                continue;
            }

            // Former HR: leaves the workspace, unless they still have tasks
            // assigned in it (Penugasan HR) — then they stay as a plain member.
            if ($row->is_synced && ! $this->hasAssignedTasks($workspace, $userId)) {
                WorkspaceMember::query()->where('workspace_id', $workspace->id)->where('user_id', $userId)->delete();
                $removed[] = $userId;

                continue;
            }

            if ($row->is_synced || $row->role->canManage()) {
                $this->update($workspace, $userId, ['role' => WorkspaceRole::Member->value, 'is_synced' => false]);
                $changed = true;
            }
        }

        $this->cleanup->handle($workspace, $removed);

        if ($added !== [] || $removed !== [] || $changed) {
            WorkspaceMembersChanged::dispatch($workspace, $added, $removed);
        }
    }

    private static function roleFor(Workspace $workspace, string $userId): WorkspaceRole
    {
        return $userId === $workspace->owner_id ? WorkspaceRole::Owner : WorkspaceRole::Admin;
    }

    private function hasAssignedTasks(Workspace $workspace, string $userId): bool
    {
        return $workspace->hasPrivateTasks()
            && DB::table('task_assignees')
                ->join('tasks', 'tasks.id', '=', 'task_assignees.task_id')
                ->where('tasks.workspace_id', $workspace->id)
                ->whereNull('tasks.deleted_at')
                ->where('task_assignees.user_id', $userId)
                ->exists();
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function update(Workspace $workspace, string $userId, array $values): void
    {
        WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $userId)
            ->update([...$values, 'updated_at' => now()]);
    }
}
