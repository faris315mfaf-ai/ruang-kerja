<?php

namespace App\Domain\Okr\Queries;

use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Services\OkrPeople;
use App\Domain\Okr\Services\OkrPresenter;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\Objective;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Props of /okr/{objective}: the objective with its key results, check-ins,
 * linked tasks (only those the viewer can see) and abilities, plus the
 * people who may own a key result and the quarters of the edit form.
 */
final class ObjectiveDetail
{
    public function __construct(
        private readonly OkrPresenter $presenter,
        private readonly OkrPeople $people,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(Objective $objective, User $viewer): array
    {
        $objective->load([
            'division',
            'owner:id,name',
            'keyResults.owner:id,name',
            'keyResults.checkins' => fn (HasMany $checkins) => $checkins->with('author:id,name')->orderBy('checked_on')->orderBy('created_at'),
            'keyResults.tasks' => fn (BelongsToMany $tasks) => $tasks
                ->whereIn('tasks.id', Task::query()->visibleTo($viewer)->select('tasks.id'))
                ->with(['workspace:id,key', 'assignees:id,name'])
                ->orderBy('tasks.due_date')
                ->orderBy('tasks.id'),
        ]);

        $current = Quarter::of(OfficeTime::today());

        return [
            'today' => OfficeTime::todayString(),
            'objective' => $this->presenter->detail($objective, $viewer),
            'people' => $this->people->forDivision($objective->division)
                ->map(fn (User $user): array => $this->presenter->person($user))
                ->values()
                ->all(),
            'quarters' => array_values(array_unique([
                $current->next()->key(), $current->key(), $current->previous()->key(), $objective->quarter,
            ])),
        ];
    }
}
