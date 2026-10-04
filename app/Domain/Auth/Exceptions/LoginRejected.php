<?php

namespace App\Domain\Auth\Exceptions;

use RuntimeException;

/**
 * A sign-in attempt that must be refused with a user-facing (Indonesian) message.
 */
final class LoginRejected extends RuntimeException
{
    public const string WRONG_DOMAIN = 'wrong_domain';

    public const string MISSING_HD = 'missing_hd';

    public const string UNVERIFIED_EMAIL = 'unverified_email';

    public const string NOT_REGISTERED = 'not_registered';

    public const string INACTIVE = 'inactive';

    public function __construct(
        public readonly string $reason,
        string $message,
        public readonly ?string $email = null,
    ) {
        parent::__construct($message);
    }

    public static function wrongDomain(?string $email): self
    {
        return new self(
            self::WRONG_DOMAIN,
            'Gunakan akun Google kantor Anda. Akun di luar domain perusahaan tidak bisa masuk.',
            $email,
        );
    }

    public static function missingHostedDomain(?string $email): self
    {
        return new self(
            self::MISSING_HD,
            'Akun ini bukan akun Google Workspace perusahaan. Gunakan email kantor Anda.',
            $email,
        );
    }

    public static function unverifiedEmail(?string $email): self
    {
        return new self(
            self::UNVERIFIED_EMAIL,
            'Email akun Google ini belum terverifikasi oleh Google.',
            $email,
        );
    }

    public static function notRegistered(?string $email): self
    {
        return new self(
            self::NOT_REGISTERED,
            'Akun Anda belum didaftarkan HR. Hubungi HR untuk mengaktifkan akses.',
            $email,
        );
    }

    public static function inactive(?string $email): self
    {
        return new self(
            self::INACTIVE,
            'Akun Anda tidak aktif. Hubungi HR bila ini keliru.',
            $email,
        );
    }
}
