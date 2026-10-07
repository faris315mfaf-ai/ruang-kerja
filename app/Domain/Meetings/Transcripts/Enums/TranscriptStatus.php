<?php

namespace App\Domain\Meetings\Transcripts\Enums;

/**
 * Lifecycle of a meeting transcript (meeting_transcripts.status):
 * the worker records → transcribes → the app summarizes → ready, or failed.
 */
enum TranscriptStatus: string
{
    case Recording = 'recording';
    case Transcribing = 'transcribing';
    case Summarizing = 'summarizing';
    case Ready = 'ready';
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::Recording => 'Merekam',
            self::Transcribing => 'Mentranskrip',
            self::Summarizing => 'Meringkas',
            self::Ready => 'Siap',
            self::Failed => 'Gagal',
        };
    }

    /** Still moving: the UI polls the status. */
    public function inProgress(): bool
    {
        return in_array($this, [self::Recording, self::Transcribing, self::Summarizing], true);
    }
}
