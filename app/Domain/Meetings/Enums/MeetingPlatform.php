<?php

namespace App\Domain\Meetings\Enums;

/**
 * meetings.platform: where the meeting happens. Online links (Meet, Zoom) are
 * pasted by the organizer while Google Calendar/Meet integration is on hold;
 * `video` is the built-in video room (LiveKit, config/livekit.php) and needs
 * no link.
 */
enum MeetingPlatform: string
{
    case Meet = 'meet';
    case Zoom = 'zoom';
    case Room = 'room';
    case Client = 'client';
    case Video = 'video';

    public function label(): string
    {
        return match ($this) {
            self::Meet => 'Google Meet',
            self::Zoom => 'Zoom',
            self::Room => 'Tatap muka',
            self::Client => 'Di klien',
            self::Video => 'Video RuangKerja',
        };
    }

    /** Online meetings: a join link (Meet, Zoom) or the built-in video room. */
    public function isOnline(): bool
    {
        return $this === self::Meet || $this === self::Zoom || $this === self::Video;
    }
}
