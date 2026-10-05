<?php

namespace App\Domain\Tasks\Digest;

use App\Domain\Notifications\Digest\Contracts\DigestSection;
use App\Domain\Notifications\Digest\Data\DigestItem;
use App\Domain\Notifications\Digest\Data\DigestSectionData;
use App\Domain\Notifications\Support\IndonesianDate;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Daily digest: "Tenggat hari ini (n)" with a note about tomorrow.
 */
final class TasksDueTodaySection implements DigestSection
{
    private const int LIMIT = 5;

    public function build(User $user, CarbonImmutable $date): ?DigestSectionData
    {
        $query = TaskDigestQuery::assignedTo($user)->whereDate('tasks.due_date', $date->toDateString());
        $count = (clone $query)->count();

        if ($count === 0) {
            return null;
        }

        $items = (clone $query)->orderBy('tasks.priority')->orderBy('tasks.number')->limit(self::LIMIT)->get()
            ->map(fn (Task $task): DigestItem => new DigestItem($task->title, code: $task->displayKey()))
            ->all();

        $tomorrow = TaskDigestQuery::assignedTo($user)->whereDate('tasks.due_date', $date->addDay()->toDateString())
            ->orderBy('tasks.priority')->orderBy('tasks.number')->first();
        $rest = $count - count($items);

        return new DigestSectionData(
            key: 'tasks.due_today',
            title: "Tenggat hari ini ({$count})",
            tileLabel: 'Tenggat hari ini',
            count: $count,
            items: array_values($items),
            note: $tomorrow !== null ? 'Besok ('.IndonesianDate::short($date->addDay()).'): '.$tomorrow->displayKey().' '.$tomorrow->title : null,
            more: $rest > 0 ? "dan {$rest} tugas lainnya" : null,
        );
    }
}
