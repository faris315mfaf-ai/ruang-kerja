<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\MinutesSource;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Queries\PreviousMinutes;
use App\Domain\Meetings\Services\MinutesCollab;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\RoomEvents;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Pre-join "Notulen yang dipakai" (docs/fitur/rapat-video-kontrak.md §2):
 * the organizer or minute taker starts the notes of an occurrence from
 *
 * - continue: a "Tindak lanjut rapat lalu" section listing the open
 *   follow-ups of the previous minutes of the same meeting/series;
 * - template: the meeting's own template (label from its type/title, e.g.
 *   "Templat Rapat mingguan") = one section per agenda item (Keputusan and
 *   Tindak lanjut are the minutes' fixed blocks);
 * - blank: no sections, only while nothing was written yet.
 *
 * Idempotent per occurrence: once a source is recorded, later calls change
 * nothing (`applied` false). Changes are versioned like an autosave and
 * broadcast (minutes.source_chosen + minutes.updated).
 */
final class ChooseMinutesSource
{
    public const string CARRY_OVER_TITLE = 'Tindak lanjut rapat lalu';

    public const string EMPTY_AGENDA_TITLE = 'Agenda';

    private const array MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    public function __construct(
        private readonly MinutesStore $store,
        private readonly SaveMinutes $save,
        private readonly PreviousMinutes $previous,
        private readonly RoomEvents $events,
        private readonly MinutesCollab $collab,
    ) {}

    /**
     * @return array{minutes: MeetingMinutes, applied: bool}
     */
    public function handle(Occurrence $occurrence, User $actor, MinutesSource $source): array
    {
        $result = DB::transaction(function () use ($occurrence, $actor, $source): array {
            $minutes = $this->store->open($occurrence);

            if ($minutes->notes_source !== null) {
                return ['minutes' => $minutes, 'applied' => false];
            }

            if ($minutes->isFinal()) {
                throw ValidationException::withMessages(['minutes' => 'Notulen sudah final. Buka kembali draf untuk mengubahnya.']);
            }

            $content = $minutes->content();
            $sections = match ($source) {
                MinutesSource::Continue => $this->continued($occurrence, $content['sections']),
                MinutesSource::Template => self::templated($occurrence->meeting->agenda, $content['sections']),
                MinutesSource::Blank => $this->isUntouched($minutes) ? [] : $content['sections'],
            };

            $changed = $sections != $content['sections'];
            $minutes->forceFill([
                'sections' => $sections,
                'notes_source' => $source,
                'notes_source_by' => $actor->id,
                'notes_source_at' => now(),
                'updated_by' => $changed ? $actor->id : $minutes->updated_by,
            ])->save();

            if ($changed) {
                $this->save->snapshot($minutes, $actor, force: false);
                $this->collab->replaceLive($minutes);
            }

            return ['minutes' => $minutes, 'applied' => true];
        });

        if ($result['applied']) {
            $this->events->sourceChosen($occurrence, $result['minutes']);
            $this->events->minutesChanged($result['minutes'], $occurrence->meeting);
        }

        return $result;
    }

    /**
     * Label of the template option: the series type ("Templat Rapat
     * mingguan", "Templat Rapat harian", "Templat Rapat Sen–Rab–Jum") or the
     * title of a one-off meeting ("Templat Review vendor logistik").
     */
    public static function templateLabel(Meeting $meeting): string
    {
        return 'Templat '.match ($meeting->recurrence) {
            Recurrence::Weekly => 'Rapat mingguan',
            Recurrence::Weekdays => 'Rapat harian',
            Recurrence::MonWedFri => 'Rapat Sen–Rab–Jum',
            Recurrence::None => $meeting->title,
        };
    }

    /**
     * Template sections: every agenda item in agenda order (keeping what was
     * already written under that title), then any other existing sections.
     *
     * @param  list<string>  $agenda
     * @param  list<array{title: string, body: string}>  $sections
     * @return list<array{title: string, body: string}>
     */
    public static function templated(array $agenda, array $sections): array
    {
        $titles = $agenda !== [] ? array_values(array_unique($agenda)) : [self::EMPTY_AGENDA_TITLE];
        $byTitle = [];

        foreach ($sections as $section) {
            $byTitle[$section['title']] ??= $section;
        }

        $result = array_map(fn (string $title): array => $byTitle[$title] ?? ['title' => $title, 'body' => ''], $titles);

        foreach ($sections as $section) {
            if (! in_array($section['title'], $titles, true)) {
                $result[] = $section;
            }
        }

        return $result;
    }

    /**
     * @param  list<array{title: string, body: string}>  $sections
     * @return list<array{title: string, body: string}>
     */
    private function continued(Occurrence $occurrence, array $sections): array
    {
        foreach ($sections as $section) {
            if ($section['title'] === self::CARRY_OVER_TITLE) {
                return $sections;
            }
        }

        $items = $this->previous->openItems($this->previous->for($occurrence));

        if ($items === []) {
            return $sections;
        }

        $names = User::query()
            ->whereIn('id', array_values(array_unique(array_filter(array_map(fn (MeetingActionItem $item): ?string => $item->assignee_id, $items)))))
            ->pluck('name', 'id')
            ->all();

        $lines = array_map(fn (MeetingActionItem $item): string => self::line($item, $names), $items);

        return [...$sections, ['title' => self::CARRY_OVER_TITLE, 'body' => implode("\n", $lines)]];
    }

    /**
     * "• Kirim jadwal servis ke vendor — Rizky Aditya · tenggat 3 Okt · OPS-1270".
     *
     * @param  array<string, string>  $names
     */
    private static function line(MeetingActionItem $item, array $names): string
    {
        $parts = [];

        if ($item->assignee_id !== null && isset($names[$item->assignee_id])) {
            $parts[] = $names[$item->assignee_id];
        }

        if ($item->due_date !== null) {
            $parts[] = 'tenggat '.$item->due_date->day.' '.self::MONTHS[$item->due_date->month - 1];
        }

        if ($item->task_id !== null && $item->relationLoaded('task') && $item->task !== null) {
            $parts[] = $item->task->displayKey();
        }

        return '• '.$item->text.($parts !== [] ? ' — '.implode(' · ', $parts) : '');
    }

    private function isUntouched(MeetingMinutes $minutes): bool
    {
        foreach ($minutes->sections as $section) {
            if (trim((string) $section['body']) !== '') {
                return false;
            }
        }

        return $minutes->decisions === []
            && ! MeetingActionItem::query()->where('minutes_id', $minutes->id)->exists();
    }
}
