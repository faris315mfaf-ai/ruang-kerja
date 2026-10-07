<?php

namespace App\Domain\Auth\Enums;

/**
 * Lifecycle of a "Lupa kata sandi" request (password_reset_requests.status).
 *
 * pending → approved (HR) → used (new password saved)
 *         → rejected (HR, with a reason)
 *         → expired (24 h without a decision, or 30 min after approval unused)
 *         → canceled (the employee asked again; the newer request replaces it)
 */
enum PasswordResetStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Used = 'used';
    case Expired = 'expired';
    case Canceled = 'canceled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Menunggu persetujuan HR',
            self::Approved => 'Disetujui',
            self::Rejected => 'Ditolak',
            self::Used => 'Selesai',
            self::Expired => 'Kedaluwarsa',
            self::Canceled => 'Digantikan permintaan baru',
        };
    }

    /**
     * Still waiting for something (a decision or the new password).
     */
    public function isOpen(): bool
    {
        return $this === self::Pending || $this === self::Approved;
    }
}
