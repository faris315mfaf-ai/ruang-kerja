<?php

namespace App\Domain\Meetings\Transcripts\Enums;

/**
 * The AI draft minutes of a transcript (meeting_transcripts.draft_status).
 */
enum DraftStatus: string
{
    case Pending = 'pending';
    case Ready = 'ready';
    case Failed = 'failed';
    /** No MINUTES_LLM_API_KEY: transcript only. */
    case Disabled = 'disabled';
    /** "Masukkan ke notulen" done. */
    case Inserted = 'inserted';
    /** "Buang draf". */
    case Discarded = 'discarded';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Sedang diringkas',
            self::Ready => 'Draf siap diperiksa',
            self::Failed => 'Ringkasan gagal',
            self::Disabled => 'Ringkasan AI tidak aktif',
            self::Inserted => 'Sudah dimasukkan ke notulen',
            self::Discarded => 'Draf dibuang',
        };
    }

    /** The notulis can still insert, discard or turn suggestions into tasks. */
    public function open(): bool
    {
        return $this === self::Ready;
    }
}
