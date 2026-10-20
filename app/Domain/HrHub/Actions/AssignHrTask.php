<?php

namespace App\Domain\HrHub\Actions;

use App\Domain\HrHub\Enums\SystemWorkspace;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Tasks\Actions\AddChecklistItem;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\Division;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkspaceMember;
use App\Providers\HrHubServiceProvider;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Beri tugas" in Ruang HR › Penugasan (keputusan pemilik 20 Okt 2026): HR
 * gives a task to people, whole divisions (incl. sub-divisions) or teams of
 * their company. `per_person` = one task per recipient (assignee = that
 * person), `shared` = one task for all of them. Tasks live in the system
 * workspace "Penugasan HR" (private tasks): recipients become plain members
 * and only see the tasks assigned to them.
 */
final class AssignHrTask
{
    public const int MAX_RECIPIENTS = 200;

    public const int MAX_CHECKLIST = 20;

    public function __construct(
        private readonly EnsureHrWorkspaces $ensure,
        private readonly CreateTask $createTask,
        private readonly AddChecklistItem $addChecklistItem,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{user_ids?: list<string>, division_ids?: list<string>, team_ids?: list<string>, mode: 'per_person'|'shared', title: string, description_text?: string|null, due_date?: string|null, priority?: int|null, checklist?: list<string>}  $input
     * @return list<Task>
     */
    public function handle(User $actor, array $input): array
    {
        if (! HrHubServiceProvider::canView($actor)) {
            throw new AuthorizationException('Hanya HR yang dapat memberi tugas dari Ruang HR.');
        }

        $recipients = $this->recipients($actor, $input);

        if ($recipients === []) {
            throw ValidationException::withMessages(['recipients' => 'Pilih minimal satu karyawan aktif sebagai penerima.']);
        }

        if (count($recipients) > self::MAX_RECIPIENTS) {
            throw ValidationException::withMessages(['recipients' => 'Penerima maksimal '.self::MAX_RECIPIENTS.' orang sekali beri tugas.']);
        }

        $checklist = array_values(array_filter(array_map(
            fn (string $item): string => trim($item),
            $input['checklist'] ?? [],
        ), fn (string $item): bool => $item !== ''));

        if (count($checklist) > self::MAX_CHECKLIST) {
            throw ValidationException::withMessages(['checklist' => 'Checklist maksimal '.self::MAX_CHECKLIST.' butir.']);
        }

        $workspace = $this->ensure->handle($actor->company_id)[SystemWorkspace::HrAssignments->value]
            ?? throw ValidationException::withMessages(['recipients' => 'Workspace Penugasan HR belum dapat dibuat.']);

        $tasks = DB::transaction(function () use ($actor, $input, $recipients, $checklist, $workspace): array {
            $existing = WorkspaceMember::query()
                ->where('workspace_id', $workspace->id)
                ->whereIn('user_id', $recipients)
                ->pluck('user_id')
                ->all();
            $added = array_values(array_diff($recipients, $existing));
            $now = now();

            if ($added !== []) {
                WorkspaceMember::query()->insert(array_map(fn (string $userId): array => [
                    'workspace_id' => $workspace->id,
                    'user_id' => $userId,
                    'role' => WorkspaceRole::Member->value,
                    'is_synced' => false,
                    'joined_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $added));

                WorkspaceMembersChanged::dispatch($workspace, $added, []);
            }

            $base = [
                'title' => trim($input['title']),
                'description_text' => $input['description_text'] ?? null,
                'due_date' => $input['due_date'] ?? null,
                'priority' => $input['priority'] ?? 0,
            ];
            $groups = $input['mode'] === 'shared' ? [$recipients] : array_map(fn (string $id): array => [$id], $recipients);
            $tasks = [];

            foreach ($groups as $assigneeIds) {
                $task = $this->createTask->handle($workspace, $actor, [...$base, 'assignee_ids' => $assigneeIds]);

                foreach ($checklist as $item) {
                    $this->addChecklistItem->handle($task, $item);
                }

                $tasks[] = $task;
            }

            $this->audit->log('hr.task_assigned', $workspace, null, [
                'mode' => $input['mode'],
                'recipients' => count($recipients),
                'task_ids' => array_map(fn (Task $task): string => $task->id, $tasks),
            ], $actor);

            return $tasks;
        });

        return $tasks;
    }

    /**
     * Active employees of the actor's company among the chosen people,
     * divisions (with sub-divisions) and teams, deduplicated, in name order.
     *
     * @param  array{user_ids?: list<string>, division_ids?: list<string>, team_ids?: list<string>}  $input
     * @return list<string>
     */
    private function recipients(User $actor, array $input): array
    {
        $userIds = array_values(array_unique($input['user_ids'] ?? []));
        $divisionIds = array_values(array_unique($input['division_ids'] ?? []));
        $teamIds = array_values(array_unique($input['team_ids'] ?? []));

        if ($userIds === [] && $divisionIds === [] && $teamIds === []) {
            return [];
        }

        /** @var list<string> $own divisions of the actor's company only */
        $own = array_values(array_map('strval', Division::query()->where('company_id', $actor->company_id)->whereKey($divisionIds)->pluck('id')->all()));
        $divisionIds = $own === [] ? [] : Division::withDescendantIds($own);

        /** @var list<string> */
        return User::query()
            ->active()
            ->where('company_id', $actor->company_id)
            ->where(function (Builder $scope) use ($userIds, $divisionIds, $teamIds): void {
                $scope->whereIn('id', $userIds)
                    ->orWhereIn('division_id', $divisionIds)
                    ->orWhereIn('team_id', $teamIds);
            })
            ->orderBy('name')
            ->pluck('id')
            ->all();
    }
}
