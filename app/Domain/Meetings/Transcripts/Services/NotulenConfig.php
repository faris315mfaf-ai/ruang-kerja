<?php

namespace App\Domain\Meetings\Transcripts\Services;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\Meeting;

/**
 * Whether "Notulen otomatis" can run: the worker URL + secret and LiveKit are
 * configured, and the meeting is a Video RuangKerja meeting.
 */
final class NotulenConfig
{
    public function __construct(private readonly VideoRooms $rooms) {}

    public function configured(): bool
    {
        $secret = (string) config('notulen.transcriber.secret');
        $callback = (string) config('notulen.transcriber.callback_secret');

        return $this->url() !== '' && strlen($secret) >= 32 && strlen($callback) >= 32 && $secret !== $callback
            && $this->rooms->configured();
    }

    public function availableFor(Meeting $meeting): bool
    {
        return $meeting->platform === MeetingPlatform::Video && $this->configured();
    }

    public function url(): string
    {
        return (string) config('notulen.transcriber.url');
    }

    public function identity(): string
    {
        return (string) config('notulen.transcriber.identity', 'rk-notulen');
    }

    public function llmEnabled(): bool
    {
        return (string) config('notulen.llm.api_key') !== '';
    }

    public function retentionDays(): int
    {
        return max(1, (int) config('notulen.retention_days', 90));
    }

    /** meetings.auto_minutes (column added by this module; the model has no cast for it). */
    public static function autoMinutes(Meeting $meeting): bool
    {
        return (bool) $meeting->getAttribute('auto_minutes');
    }
}
