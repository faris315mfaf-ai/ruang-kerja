<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Services\MinutesDocument;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Tasks\Services\RichText;
use App\Models\MeetingMinutes;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Collab server → Laravel: stores the Yjs state and ProseMirror snapshot of
 * the collaborative room minutes (MinutesCollab) and mirrors its text into
 * the structured minutes (sections, decisions; attendance and follow-ups are
 * untouched). A text change is versioned like an autosave of the last
 * editor and broadcast as minutes.updated. Final minutes are locked: the
 * store is accepted but changes nothing (tokens are read-only by then).
 */
final class StoreMinutesDocument
{
    public function __construct(
        private readonly SaveMinutes $save,
        private readonly RoomEvents $events,
    ) {}

    /**
     * @param  array<mixed>|null  $body
     */
    public function handle(MeetingMinutes $minutes, string $state, ?array $body, ?User $editor): bool
    {
        $result = DB::transaction(function () use ($minutes, $state, $body, $editor): ?MeetingMinutes {
            $locked = MeetingMinutes::query()->lockForUpdate()->findOrFail($minutes->id);

            if ($locked->isFinal()) {
                return null;
            }

            $content = $body !== null ? RichText::sanitize($body, colors: true) : null;
            $text = MinutesDocument::fromDoc($content);
            $changed = $text['sections'] != $locked->sections || $text['decisions'] != $locked->decisions;

            $locked->forceFill([
                'doc_state' => $state,
                'doc_content' => $content,
                ...($changed ? [...$text, 'updated_by' => $editor->id ?? $locked->updated_by] : []),
            ])->save();

            if (! $changed) {
                return null;
            }

            if ($editor !== null) {
                $this->save->snapshot($locked, $editor, force: false);
            }

            return $locked;
        });

        if ($result !== null) {
            $this->events->minutesChanged($result);
        }

        return $result !== null;
    }
}
