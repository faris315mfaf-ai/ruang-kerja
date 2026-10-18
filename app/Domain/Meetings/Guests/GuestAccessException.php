<?php

namespace App\Domain\Meetings\Guests;

use App\Domain\Tenancy\Support\CurrentCompany;
use Carbon\CarbonImmutable;
use RuntimeException;

/**
 * A guest action that cannot happen right now. `reason` is the machine code
 * the guest page switches on (docs/sesi/rapat-tamu-eksternal.md §4); the
 * message is Indonesian and safe to show. Never carries the token.
 */
final class GuestAccessException extends RuntimeException
{
    public function __construct(
        public readonly string $reason,
        string $message,
        public readonly int $status = 403,
    ) {
        parent::__construct($message);
    }

    public static function notYet(CarbonImmutable $opensAt): self
    {
        $local = $opensAt->setTimezone(CurrentCompany::timezone());
        $when = $local->isToday() ? $local->format('H.i') : $local->format('d/m/Y H.i');

        return new self('ruang_belum_dibuka', "Ruang rapat dibuka pukul {$when}.", 409);
    }

    public static function closed(): self
    {
        return new self('ditutup', 'Rapat sudah selesai atau dibatalkan.', 410);
    }

    public static function expired(): self
    {
        return new self('kedaluwarsa', 'Tautan ini sudah kedaluwarsa. Minta tautan baru kepada penyelenggara.', 410);
    }

    public static function notAdmitted(string $status): self
    {
        return match ($status) {
            'waiting' => new self('menunggu', 'Penyelenggara belum mengizinkan Anda masuk.', 403),
            'denied' => new self('ditolak', 'Penyelenggara menolak permintaan masuk Anda.', 403),
            'removed' => new self('dikeluarkan', 'Penyelenggara mengeluarkan Anda dari rapat ini.', 403),
            default => new self('belum_meminta', 'Minta izin masuk terlebih dahulu.', 403),
        };
    }
}
