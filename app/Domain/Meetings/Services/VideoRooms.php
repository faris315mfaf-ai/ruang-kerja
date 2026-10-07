<?php

namespace App\Domain\Meetings\Services;

use App\Domain\Meetings\Data\Occurrence;
use Carbon\CarbonImmutable;

/**
 * Rules of the built-in video room (config/livekit.php):
 *
 * - Configured = url, key and secret set; otherwise "Video RuangKerja" is
 *   hidden from the form and video meetings show a note instead of a button.
 * - One LiveKit room per occurrence: "rk-{meeting ulid}-{yyyymmdd}" (a
 *   series gets a fresh room each date, so attendance stays per occurrence).
 * - Join window: `join_before_minutes` before the start until
 *   `join_after_minutes` after the end (organizer: any time).
 */
final class VideoRooms
{
    private const string ROOM_PATTERN = '/^rk-([0-9a-hjkmnp-tv-z]{26})-(\d{4})(\d{2})(\d{2})$/';

    public function configured(): bool
    {
        return $this->url() !== '' && $this->apiKey() !== '' && $this->apiSecret() !== '';
    }

    /** Browser-facing WebSocket URL (wss://…). */
    public function url(): string
    {
        return rtrim((string) config('livekit.url'), '/');
    }

    /** Server-to-server HTTP base of the Room Service API. */
    public function apiUrl(): string
    {
        $api = (string) config('livekit.api_url');
        $base = $api !== '' ? $api : (string) preg_replace('/^ws/', 'http', $this->url());

        return rtrim($base, '/');
    }

    public function apiKey(): string
    {
        return (string) config('livekit.api_key');
    }

    public function apiSecret(): string
    {
        return (string) config('livekit.api_secret');
    }

    public function roomName(Occurrence $occurrence): string
    {
        return 'rk-'.strtolower($occurrence->meeting->id).'-'.str_replace('-', '', $occurrence->date);
    }

    /**
     * @return array{meeting_id: string, date: string}|null
     */
    public function parseRoom(string $room): ?array
    {
        if (preg_match(self::ROOM_PATTERN, $room, $match) !== 1) {
            return null;
        }

        if (! checkdate((int) $match[3], (int) $match[4], (int) $match[2])) {
            return null;
        }

        return ['meeting_id' => $match[1], 'date' => "{$match[2]}-{$match[3]}-{$match[4]}"];
    }

    public function opensAt(Occurrence $occurrence): CarbonImmutable
    {
        return $occurrence->startsAt->subMinutes(max(0, (int) config('livekit.join_before_minutes', 15)));
    }

    public function closesAt(Occurrence $occurrence): CarbonImmutable
    {
        return $occurrence->endsAt->addMinutes(max(0, (int) config('livekit.join_after_minutes', 120)));
    }

    /** "early" before the window, "open" inside it, "closed" after it. */
    public function windowState(Occurrence $occurrence, ?CarbonImmutable $now = null): string
    {
        $now ??= CarbonImmutable::now();

        return match (true) {
            $now->lt($this->opensAt($occurrence)) => 'early',
            $now->gt($this->closesAt($occurrence)) => 'closed',
            default => 'open',
        };
    }
}
