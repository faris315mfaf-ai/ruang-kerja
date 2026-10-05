<?php

namespace App\Domain\Google\Enums;

/**
 * Document types the "Dokumen baru" menu can create.
 */
enum GoogleDocType: string
{
    case Document = 'document';
    case Spreadsheet = 'spreadsheet';
    case Presentation = 'presentation';

    public function label(): string
    {
        return match ($this) {
            self::Document => 'Google Docs',
            self::Spreadsheet => 'Google Sheets',
            self::Presentation => 'Google Slides',
        };
    }

    public function mimeType(): string
    {
        return 'application/vnd.google-apps.'.$this->value;
    }

    public function kind(): DriveFileKind
    {
        return DriveFileKind::fromMimeType($this->mimeType());
    }

    /**
     * Default title when the user leaves the name empty.
     */
    public function defaultName(): string
    {
        return match ($this) {
            self::Document => 'Dokumen tanpa judul',
            self::Spreadsheet => 'Spreadsheet tanpa judul',
            self::Presentation => 'Presentasi tanpa judul',
        };
    }
}
