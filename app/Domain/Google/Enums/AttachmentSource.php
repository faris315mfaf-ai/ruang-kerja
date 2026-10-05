<?php

namespace App\Domain\Google\Enums;

/**
 * Where an attachment's bytes live (attachments.source).
 */
enum AttachmentSource: string
{
    case Drive = 'drive';
    case Storage = 'storage';

    public function label(): string
    {
        return match ($this) {
            self::Drive => 'Google Drive',
            self::Storage => 'Penyimpanan aplikasi',
        };
    }
}
