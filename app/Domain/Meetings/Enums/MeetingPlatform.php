<?php

namespace App\Domain\Meetings\Enums;

/**
 * meetings.platform: where the meeting happens. Online links (Meet, Zoom) are
 * pasted by the organizer while Google Calendar/Meet integration is on hold.
 */
enum MeetingPlatform: string
{
    case Meet = 'meet';
    case Zoom = 'zoom';
    case Room = 'room';
    case Client = 'client';

    public function label(): string
    {
        return match ($this) {
            self::Meet => 'Google Meet',
            self::Zoom => 'Zoom',
            self::Room => 'Tatap muka',
            self::Client => 'Di klien',
        };
    }

    /** Online meetings use a join link, the others a location. */
    public function isOnline(): bool
    {
        return $this === self::Meet || $this === self::Zoom;
    }
}
