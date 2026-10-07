<?php

namespace App\Domain\Meetings\Transcripts\Actions;

use App\Domain\Meetings\Actions\AddActionItem;
use App\Domain\Meetings\Actions\ConvertActionItemsToTasks;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Exceptions\TranscriptConflict;
use App\Models\MeetingActionItem;
use App\Models\MeetingTranscript;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * "Jadikan tugas" on one suggested follow-up of the AI draft: the suggestion
 * becomes an action item of the minutes (once), then the existing flow
 * ConvertActionItemsToTasks makes the task (numbering, assignee, due date,
 * WorkspacePolicy::editTasks, idempotent).
 */
final class ConvertSuggestionToTask
{
    public function __construct(
        private readonly AddActionItem $addItem,
        private readonly ConvertActionItemsToTasks $convert,
    ) {}

    /**
     * @return array{suggestion: array<string, mixed>, task: Task|null}
     */
    public function handle(Occurrence $occurrence, User $actor, MeetingTranscript $transcript, string $suggestionId, ?Workspace $chosen = null): array
    {
        $itemId = DB::transaction(function () use ($occurrence, $actor, $transcript, $suggestionId): string {
            $locked = MeetingTranscript::query()->whereKey($transcript->id)->lockForUpdate()->firstOrFail();
            [$draft, $index] = $this->find($locked, $suggestionId);
            $suggestion = $draft['tindak_lanjut'][$index];

            if (is_string($suggestion['action_item_id'] ?? null) && MeetingActionItem::query()->whereKey($suggestion['action_item_id'])->exists()) {
                return $suggestion['action_item_id'];
            }

            $item = $this->addItem->handle($occurrence, $actor, [
                'text' => mb_substr((string) $suggestion['judul'], 0, 300),
                'assignee_id' => is_array($suggestion['penanggung_jawab'] ?? null) ? ($suggestion['penanggung_jawab']['user_id'] ?? null) : null,
                'due_date' => is_string($suggestion['tenggat'] ?? null) ? $suggestion['tenggat'] : null,
            ]);
            $draft['tindak_lanjut'][$index]['action_item_id'] = $item->id;
            $locked->forceFill(['draft' => $draft])->save();

            return $item->id;
        });

        $this->convert->handle($occurrence, $actor, [$itemId], $chosen);
        $task = MeetingActionItem::query()->with('task')->find($itemId)?->task;

        $suggestion = DB::transaction(function () use ($transcript, $suggestionId, $task): array {
            $locked = MeetingTranscript::query()->whereKey($transcript->id)->lockForUpdate()->firstOrFail();
            [$draft, $index] = $this->find($locked, $suggestionId);

            if ($task !== null) {
                $draft['tindak_lanjut'][$index]['task'] = ['id' => $task->id, 'key' => $task->displayKey(), 'href' => $task->url()];
                $locked->forceFill(['draft' => $draft])->save();
            }

            return $draft['tindak_lanjut'][$index];
        });

        return ['suggestion' => $suggestion, 'task' => $task];
    }

    /**
     * @return array{0: array<string, mixed>, 1: int}
     */
    private function find(MeetingTranscript $transcript, string $suggestionId): array
    {
        $draft = $transcript->draft;

        if (! is_array($draft) || ! in_array($transcript->draft_status, [DraftStatus::Ready, DraftStatus::Inserted], true)) {
            throw new TranscriptConflict('Tidak ada draf dengan usulan tindak lanjut.');
        }

        foreach (is_array($draft['tindak_lanjut'] ?? null) ? $draft['tindak_lanjut'] : [] as $index => $suggestion) {
            if (is_array($suggestion) && ($suggestion['id'] ?? null) === $suggestionId) {
                return [$draft, (int) $index];
            }
        }

        throw new TranscriptConflict('Usulan tindak lanjut tidak ditemukan.');
    }
}
