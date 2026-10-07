<?php

namespace App\Domain\Meetings\Transcripts\Actions;

use App\Domain\Meetings\Actions\AddActionItem;
use App\Domain\Meetings\Actions\SaveMinutes;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Exceptions\TranscriptConflict;
use App\Domain\Meetings\Transcripts\Services\DraftMerger;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\MeetingTranscript;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * "Masukkan ke notulen": the AI draft goes into the draft minutes of the
 * occurrence (SaveMinutes → versioned; the notulis's text is kept, the draft
 * is appended and marked) and every suggested follow-up not added yet
 * becomes an action item (AddActionItem) that "Jadikan tugas" can convert.
 * Once only; audited.
 */
final class InsertTranscriptDraft
{
    public function __construct(
        private readonly MinutesStore $store,
        private readonly SaveMinutes $save,
        private readonly AddActionItem $addItem,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @return array{transcript: MeetingTranscript, action_item_ids: list<string>}
     */
    public function handle(Occurrence $occurrence, User $actor, MeetingTranscript $transcript): array
    {
        return DB::transaction(function () use ($occurrence, $actor, $transcript): array {
            $locked = MeetingTranscript::query()->whereKey($transcript->id)->lockForUpdate()->firstOrFail();

            if ($locked->draft_status !== DraftStatus::Ready || ! is_array($locked->draft)) {
                throw new TranscriptConflict(match ($locked->draft_status) {
                    DraftStatus::Inserted => 'Draf ini sudah dimasukkan ke notulen.',
                    DraftStatus::Discarded => 'Draf ini sudah dibuang.',
                    DraftStatus::Pending => 'Draf masih disusun. Coba lagi sebentar lagi.',
                    default => 'Belum ada draf yang bisa dimasukkan.',
                });
            }

            $minutes = $this->store->open($occurrence);

            if ($minutes->isFinal()) {
                throw new TranscriptConflict('Notulen sudah final. Buka kembali draf notulen dulu.');
            }

            $draft = $locked->draft;
            $this->save->handle($occurrence, $actor, DraftMerger::merge($minutes->content(), $draft));

            $ids = [];
            $actions = is_array($draft['tindak_lanjut'] ?? null) ? $draft['tindak_lanjut'] : [];

            foreach ($actions as $index => $action) {
                if (! is_array($action) || ($action['action_item_id'] ?? null) !== null) {
                    continue;
                }

                $item = $this->addItem->handle($occurrence, $actor, [
                    'text' => mb_substr((string) ($action['judul'] ?? ''), 0, 300),
                    'assignee_id' => is_array($action['penanggung_jawab'] ?? null) ? ($action['penanggung_jawab']['user_id'] ?? null) : null,
                    'due_date' => is_string($action['tenggat'] ?? null) ? $action['tenggat'] : null,
                ]);
                $actions[$index]['action_item_id'] = $item->id;
                $ids[] = $item->id;
            }

            $draft['tindak_lanjut'] = $actions;
            $locked->forceFill([
                'draft' => $draft,
                'draft_status' => DraftStatus::Inserted,
                'inserted_at' => CarbonImmutable::now(),
                'inserted_by' => $actor->id,
            ])->save();

            $this->audit->log('meeting.transcript_draft_inserted', $locked, null, ['action_items' => count($ids)], $actor);

            return ['transcript' => $locked, 'action_item_ids' => $ids];
        });
    }
}
