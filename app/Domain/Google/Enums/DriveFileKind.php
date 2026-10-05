<?php

namespace App\Domain\Google\Enums;

/**
 * Coarse file category stored in drive_files.kind (icons, filters, preview).
 */
enum DriveFileKind: string
{
    case Doc = 'doc';
    case Sheet = 'sheet';
    case Slide = 'slide';
    case Pdf = 'pdf';
    case Image = 'image';
    case Folder = 'folder';
    case Other = 'other';

    public const string FOLDER_MIME = 'application/vnd.google-apps.folder';

    public function label(): string
    {
        return match ($this) {
            self::Doc => 'Google Docs',
            self::Sheet => 'Google Sheets',
            self::Slide => 'Google Slides',
            self::Pdf => 'PDF',
            self::Image => 'Gambar',
            self::Folder => 'Folder',
            self::Other => 'File',
        };
    }

    public static function fromMimeType(string $mimeType): self
    {
        return match (true) {
            $mimeType === 'application/vnd.google-apps.document' => self::Doc,
            $mimeType === 'application/vnd.google-apps.spreadsheet' => self::Sheet,
            $mimeType === 'application/vnd.google-apps.presentation' => self::Slide,
            $mimeType === self::FOLDER_MIME => self::Folder,
            $mimeType === 'application/pdf' => self::Pdf,
            str_starts_with($mimeType, 'image/') => self::Image,
            default => self::Other,
        };
    }

    /**
     * Native Google editors files (no byte size, preview via docs.google.com).
     */
    public function isGoogleNative(): bool
    {
        return in_array($this, [self::Doc, self::Sheet, self::Slide], true);
    }
}
