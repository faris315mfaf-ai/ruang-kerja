<?php

namespace App\Domain\Meetings\Enums;

/**
 * meeting_minutes.notes_source: how the notes of an occurrence were started
 * on the video pre-join screen (ChooseMinutesSource).
 */
enum MinutesSource: string
{
    /** "Lanjutkan notulen rapat lalu": open follow-ups of the previous minutes as a section. */
    case Continue = 'continue';
    /** The meeting's template (ChooseMinutesSource::templateLabel): one section per agenda item (+ Keputusan, Tindak lanjut blocks). */
    case Template = 'template';
    /** "Dokumen kosong". */
    case Blank = 'blank';

    public function label(): string
    {
        return match ($this) {
            self::Continue => 'Lanjutkan notulen rapat lalu',
            self::Template => 'Templat agenda rapat',
            self::Blank => 'Dokumen kosong',
        };
    }
}
