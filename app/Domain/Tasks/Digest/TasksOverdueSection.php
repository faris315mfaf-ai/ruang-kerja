<?php

namespace App\Domain\Tasks\Digest;

use App\Domain\Notifications\Digest\Contracts\DigestSection;
use App\Domain\Notifications\Digest\Data\DigestItem;
use App\Domain\Notifications\Digest\Data\DigestSectionData;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Daily digest: "Terlambat (n)" (danger), oldest due date first.
 */
final class TasksOverdueSection implements DigestSection
{
    private const int LIMIT = 5;

    public function build(User $user, CarbonImmutable $date): ?DigestSectionData
    {
        $query = TaskDigestQuery::assignedTo($user)->whereDate('tasks.due_date', '<', $date->toDateString());
        $count = (clone $query)->count();

        if ($count === 0) {
            return null;
        }

        $items = (clone $query)->orderBy('tasks.due_date')->orderBy('tasks.number')->limit(self::LIMIT)->get()
            ->map(function (Task $task) use ($date): DigestItem {
                $days = $task->due_date === null ? 0 : (int) CarbonImmutable::parse($task->due_date->toDateString(), $date->getTimezone())->diffInDays($date);

                return new DigestItem($task->title, code: $task->displayKey(), badge: 'Lewat '.max(1, $days).' hari', badgeTone: 'danger');
            })
            ->all();
        $rest = $count - count($items);

        return new DigestSectionData(
            key: 'tasks.overdue',
            title: "Terlambat ({$count})",
            tileLabel: 'Terlambat',
            count: $count,
            items: array_values($items),
            tone: 'danger',
            more: $rest > 0 ? "dan {$rest} tugas lainnya" : null,
        );
    }
}
