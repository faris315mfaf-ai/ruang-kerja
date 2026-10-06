<?php

namespace App\Domain\Okr\Services;

use App\Models\Division;
use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use App\Models\Objective;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * Props for resources/js/features/okr/types.ts (Objective, KeyResult,
 * KrCheckin, LinkedTask). Relations must be eager-loaded by the caller.
 *
 * @phpstan-type PersonProps array{id: string, name: string}
 * @phpstan-type DivisionProps array{id: string, name: string, code: string}
 */
final class OkrPresenter
{
    /**
     * @return PersonProps
     */
    public function person(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name];
    }

    /**
     * @return DivisionProps
     */
    public function division(Division $division): array
    {
        return ['id' => $division->id, 'name' => $division->name, 'code' => $division->code];
    }

    /**
     * List card: key results with their values only (no check-ins/tasks).
     *
     * @return array<string, mixed>
     */
    public function summary(Objective $objective): array
    {
        return $this->base($objective) + [
            'key_results' => $objective->keyResults->map(fn (KeyResult $kr): array => $this->keyResult($kr, null))->values()->all(),
        ];
    }

    /**
     * Detail page: key results with check-ins, linked tasks and abilities.
     *
     * @return array<string, mixed>
     */
    public function detail(Objective $objective, User $viewer): array
    {
        $gate = Gate::forUser($viewer);

        return $this->base($objective) + [
            'key_results' => $objective->keyResults->map(fn (KeyResult $kr): array => $this->keyResult($kr, $viewer))->values()->all(),
            'can' => [
                'update' => $gate->allows('update', $objective),
                'close' => $gate->allows('close', $objective),
                'add_key_result' => $gate->allows('createKeyResult', $objective),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function base(Objective $objective): array
    {
        return [
            'id' => $objective->id,
            'company_id' => $objective->company_id,
            'division' => $this->division($objective->division),
            'quarter' => $objective->quarter,
            'title' => $objective->title,
            'description' => $objective->description,
            'owner' => $this->person($objective->owner),
            'status' => $objective->status->value,
            'created_at' => $objective->created_at?->toIso8601ZuluString(),
            'updated_at' => $objective->updated_at?->toIso8601ZuluString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function keyResult(KeyResult $kr, ?User $viewer): array
    {
        $row = [
            'id' => $kr->id,
            'objective_id' => $kr->objective_id,
            'title' => $kr->title,
            'unit' => $kr->unit->value,
            'unit_label' => $kr->unit_label,
            'start_value' => $kr->start_value,
            'target_value' => $kr->target_value,
            'current_value' => $kr->current_value,
            'weight' => $kr->weight,
            'owner' => $this->person($kr->owner),
            'tasks' => [],
            'checkins' => [],
        ];

        if ($viewer === null) {
            return $row;
        }

        $gate = Gate::forUser($viewer);

        return [
            ...$row,
            'tasks' => $kr->tasks->map(fn (Task $task): array => $this->task($task))->values()->all(),
            'checkins' => $kr->checkins->map(fn (KeyResultCheckin $checkin): array => $this->checkin($checkin))->values()->all(),
            'can' => [
                'update' => $gate->allows('update', $kr),
                'checkin' => $gate->allows('checkin', $kr),
                'link_task' => $gate->allows('linkTask', $kr),
                'delete' => $gate->allows('delete', $kr),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function checkin(KeyResultCheckin $checkin): array
    {
        return [
            'id' => $checkin->id,
            'key_result_id' => $checkin->key_result_id,
            'date' => $checkin->checked_on->toDateString(),
            'value' => $checkin->value,
            'confidence' => $checkin->confidence,
            'note' => $checkin->note,
            'author' => $checkin->author !== null ? $this->person($checkin->author) : ['id' => '', 'name' => 'Pengguna dihapus'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function task(Task $task): array
    {
        $assignee = $task->assignees->sortBy('pivot.assigned_at')->first();

        return [
            'id' => $task->id,
            'key' => $task->displayKey(),
            'title' => $task->title,
            'status_category' => $task->status_category->value,
            'assignee' => $assignee instanceof User ? $this->person($assignee) : null,
            'due_date' => $task->due_date?->toDateString(),
            'url' => $task->url(),
        ];
    }
}
