<?php

namespace App\Domain\Monitoring\Queries;

use App\Domain\Analytics\Data\Period;
use App\Models\ManagementNote;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * The viewer's own "catatan tindakan" (Direksi dashboard and /manajemen):
 * open notes in their order, then the most recent done ones. Always scoped
 * with ManagementNote::ownedBy — never anyone else's.
 */
final class ManagementNotes
{
    /** Done notes kept on screen (the rest stays in the database). */
    public const int DONE_SHOWN = 10;

    /**
     * @return list<array<string, mixed>>
     */
    public function for(User $viewer, CarbonImmutable $now): array
    {
        $today = Period::officeDate($now)->toDateString();
        $open = ManagementNote::query()->ownedBy($viewer)->whereNull('done_at')->orderBy('position')->orderBy('created_at')->get();
        $done = ManagementNote::query()->ownedBy($viewer)->whereNotNull('done_at')->orderByDesc('done_at')->limit(self::DONE_SHOWN)->get();

        return array_values($open->concat($done)->map(fn (ManagementNote $note): array => self::item($note, $today))->all());
    }

    /**
     * @return array{id: string, body: string, due_on: string|null, done: bool, done_at: string|null, overdue: bool, created_at: string|null}
     */
    public static function item(ManagementNote $note, string $today): array
    {
        $due = $note->due_on?->toDateString();

        return [
            'id' => $note->id,
            'body' => $note->body,
            'due_on' => $due,
            'done' => $note->isDone(),
            'done_at' => $note->done_at?->toIso8601String(),
            'overdue' => ! $note->isDone() && $due !== null && $due < $today,
            'created_at' => $note->created_at?->toIso8601String(),
        ];
    }
}
