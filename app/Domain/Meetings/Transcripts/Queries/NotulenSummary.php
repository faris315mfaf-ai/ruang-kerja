<?php

namespace App\Domain\Meetings\Transcripts\Queries;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Meetings\Transcripts\Services\TranscriptConsents;
use App\Models\MeetingTranscript;
use App\Models\User;
use App\Policies\MeetingTranscriptPolicy;

/**
 * `NotulenSummary` of docs/fitur/notulen-otomatis-kontrak.md §2.1: settings,
 * the viewer's consent, transcript status (no text) and the AI draft for one
 * occurrence. Two queries (transcript, consent). Rapat pages add it as the
 * Inertia prop `notulen`; GET …/notulen-otomatis/status returns the same.
 */
final class NotulenSummary
{
    public function __construct(
        private readonly NotulenConfig $config,
        private readonly TranscriptConsents $consents,
        private readonly MeetingTranscriptPolicy $policy,
    ) {}

    /**
     * Room / pre-join / detail prop (NotulenBridge): null when the meeting
     * cannot use notulen otomatis right now — not a video meeting, or the
     * worker is not configured and the switch is off. No queries then.
     *
     * @return array<string, mixed>|null
     */
    public function for(Occurrence $occurrence, User $viewer): ?array
    {
        $meeting = $occurrence->meeting;

        if (! $this->config->availableFor($meeting) && ! NotulenConfig::autoMinutes($meeting)) {
            return null;
        }

        return $this->summary($occurrence, $viewer);
    }

    /**
     * Always the full summary (status endpoint, review page, actions).
     *
     * @return array<string, mixed>
     */
    public function summary(Occurrence $occurrence, User $viewer, ?MeetingTranscript $transcript = null): array
    {
        $meeting = $occurrence->meeting;
        $transcript ??= MeetingTranscript::query()->forOccurrence($meeting->id, $occurrence->date)->first();
        $auto = NotulenConfig::autoMinutes($meeting);
        $canView = $this->policy->view($viewer, $meeting)->allowed();
        $base = '/rapat/'.$meeting->id.'/notulen-otomatis';
        $query = '?tanggal='.$occurrence->date;

        return [
            'available' => $this->config->availableFor($meeting),
            'auto_minutes' => $auto,
            'can_configure' => $this->policy->configure($viewer, $meeting)->allowed(),
            'can_manage' => $this->policy->manage($viewer, $meeting)->allowed(),
            'can_view_transcript' => $canView,
            'notice' => $auto ? $this->notice() : null,
            'notice_points' => $auto ? $this->noticePoints() : [],
            'consent' => [
                'opted_out' => $canView && $this->consents->optedOut($meeting, $viewer),
                'can_change' => $this->policy->consent($viewer, $meeting)->allowed(),
            ],
            // Leadership observers who were not invited see the status only (audit T-09).
            'optout_count' => $canView ? $this->consents->optedOutCount($meeting) : 0,
            'llm' => [
                'enabled' => $this->config->llmEnabled(),
                'provider' => (string) config('notulen.llm.provider'),
                'outside_indonesia' => (bool) config('notulen.llm.outside_indonesia'),
            ],
            'retention_days' => $this->config->retentionDays(),
            'links' => [
                'page' => $base.$query,
                'status' => $base.'/status'.$query,
                'transcript' => $base.'/transkrip'.$query,
                'settings' => $base.'/pengaturan',
                'consent' => $base.'/persetujuan',
                'insert' => $base.'/masukkan'.$query,
                'discard' => $base.'/draf'.$query,
                'resummarize' => $base.'/ringkas-ulang'.$query,
                // Replace {id} with a suggestion id ("tl-1").
                'task' => $base.'/tindak-lanjut/{id}/tugas'.$query,
                'minutes' => '/rapat/'.$meeting->id.'/notulen'.$query,
            ],
            'transcript' => $transcript === null ? null : ($canView ? self::transcript($transcript) : self::statusOnly($transcript)),
            'draft' => $transcript !== null && $canView ? self::draft($transcript) : null,
        ];
    }

    /**
     * The privacy notice shown in the pre-join screen and the room (UU PDP).
     */
    public function notice(): string
    {
        return 'Notulen otomatis aktif — suara Anda ditranskrip setelah rapat. '.implode(' ', $this->noticePoints());
    }

    /**
     * @return list<string>
     */
    public function noticePoints(): array
    {
        $points = [
            'Audio dihapus segera setelah transkripsi.',
            'Transkrip disimpan '.$this->config->retentionDays().' hari dan hanya bisa dibuka peserta rapat.',
        ];

        if ($this->config->llmEnabled() && (bool) config('notulen.llm.outside_indonesia')) {
            $points[] = 'Ringkasan diproses oleh '.config('notulen.llm.provider').' di luar Indonesia.';
        }

        $points[] = 'Anda bisa memilih "Jangan transkrip suara saya".';

        return $points;
    }

    /**
     * @return array<string, mixed>
     */
    public static function transcript(MeetingTranscript $transcript): array
    {
        return [
            'id' => $transcript->id,
            'status' => $transcript->status->value,
            'status_label' => $transcript->status->label(),
            'error' => $transcript->error,
            'language' => $transcript->language,
            'model' => $transcript->model,
            'duration_seconds' => $transcript->duration_seconds,
            'segment_count' => count($transcript->segments),
            'speakers' => self::speakers($transcript),
            'started_at' => $transcript->started_at?->toIso8601ZuluString('millisecond'),
            'updated_at' => $transcript->updated_at?->toIso8601ZuluString('millisecond'),
            'purge_after' => $transcript->purge_after?->toIso8601ZuluString('millisecond'),
        ];
    }

    /**
     * Status without who spoke, how long or how many lines (non-participants).
     *
     * @return array<string, mixed>
     */
    public static function statusOnly(MeetingTranscript $transcript): array
    {
        return [
            'id' => $transcript->id,
            'status' => $transcript->status->value,
            'status_label' => $transcript->status->label(),
            'error' => null,
            'language' => null,
            'model' => null,
            'duration_seconds' => null,
            'segment_count' => 0,
            'speakers' => [],
            'started_at' => null,
            'updated_at' => $transcript->updated_at?->toIso8601ZuluString('millisecond'),
            'purge_after' => null,
        ];
    }

    /**
     * Who spoke and for how long (seconds), most first.
     *
     * @return list<array{identity: string, user_id: string|null, name: string, seconds: int}>
     */
    public static function speakers(MeetingTranscript $transcript): array
    {
        $speakers = [];

        foreach ($transcript->segments as $segment) {
            $id = $segment['speaker_identity'];
            $speakers[$id] ??= ['identity' => $id, 'user_id' => $segment['user_id'], 'name' => $segment['speaker_name'], 'ms' => 0];
            $speakers[$id]['ms'] += max(0, $segment['end_ms'] - $segment['start_ms']);
        }

        usort($speakers, fn (array $a, array $b): int => $b['ms'] <=> $a['ms']);

        return array_map(fn (array $s): array => [
            'identity' => $s['identity'],
            'user_id' => $s['user_id'],
            'name' => $s['name'],
            'seconds' => intdiv($s['ms'], 1000),
        ], $speakers);
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function draft(MeetingTranscript $transcript): ?array
    {
        if ($transcript->draft_status === null) {
            return null;
        }

        $draft = is_array($transcript->draft) ? $transcript->draft : [];
        $content = in_array($transcript->draft_status->value, ['ready', 'inserted'], true);

        return [
            'status' => $transcript->draft_status->value,
            'status_label' => $transcript->draft_status->label(),
            'error' => $transcript->draft_error,
            'model' => $transcript->draft_model,
            'generated_at' => $transcript->draft_generated_at?->toIso8601ZuluString('millisecond'),
            'inserted_at' => $transcript->inserted_at?->toIso8601ZuluString('millisecond'),
            'discarded_at' => $transcript->discarded_at?->toIso8601ZuluString('millisecond'),
            'ringkasan' => $content ? (string) ($draft['ringkasan'] ?? '') : '',
            'agenda' => $content ? array_values((array) ($draft['agenda'] ?? [])) : [],
            'keputusan' => $content ? array_values((array) ($draft['keputusan'] ?? [])) : [],
            'tindak_lanjut' => $content ? array_values((array) ($draft['tindak_lanjut'] ?? [])) : [],
            'perlu_dicek' => $content ? array_values((array) ($draft['perlu_dicek'] ?? [])) : [],
        ];
    }

    /**
     * `TranscriptSegments` (§2.2): lines with their index.
     *
     * @return array<string, mixed>
     */
    public static function segments(MeetingTranscript $transcript): array
    {
        $ready = in_array($transcript->status->value, ['ready', 'summarizing'], true);

        return [
            'transcript_id' => $transcript->id,
            'status' => $transcript->status->value,
            'language' => $transcript->language,
            'duration_seconds' => $transcript->duration_seconds,
            'speakers' => self::speakers($transcript),
            'segments' => $ready ? array_map(
                fn (array $segment, int $index): array => [
                    'i' => $index,
                    'speaker_identity' => $segment['speaker_identity'],
                    'user_id' => $segment['user_id'],
                    'speaker_name' => $segment['speaker_name'],
                    'start_ms' => $segment['start_ms'],
                    'end_ms' => $segment['end_ms'],
                    'text' => $segment['text'],
                ],
                $transcript->segments,
                array_keys($transcript->segments),
            ) : [],
        ];
    }
}
