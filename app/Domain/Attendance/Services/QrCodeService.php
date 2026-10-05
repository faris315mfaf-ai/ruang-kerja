<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\QrCode;
use App\Domain\Attendance\Data\QrPayload;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\QrToken;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Dynamic kiosk QR codes (docs/ARCHITECTURE.md §3.2).
 *
 *   window = floor(unix / 30)
 *   s      = HMAC-SHA256(ATTENDANCE_QR_SECRET, "{location_id}|{window}"),
 *            first 128 bits as hex (shorter code = less dense QR, easier to scan)
 *   QR     = ruangkerja://checkin?l={location_id}&w={window}&s={s}
 *
 * A scan is accepted when the HMAC matches, the window is the current one
 * ± tolerance, and an active kiosk actually displayed that code (qr_tokens).
 */
final class QrCodeService
{
    public function window(CarbonInterface $at): int
    {
        return intdiv($at->getTimestamp(), $this->windowSeconds());
    }

    public function windowStart(int $window): CarbonImmutable
    {
        return CarbonImmutable::createFromTimestampUTC($window * $this->windowSeconds());
    }

    public const int SIGNATURE_LENGTH = 32;

    public function sign(string $locationId, int $window): string
    {
        return substr(hash_hmac('sha256', $locationId.'|'.$window, $this->secret()), 0, self::SIGNATURE_LENGTH);
    }

    public function payload(string $locationId, int $window): string
    {
        return config()->string('attendance.qr.scheme').'?'.http_build_query([
            'l' => $locationId,
            'w' => $window,
            's' => $this->sign($locationId, $window),
        ]);
    }

    /**
     * The code the kiosk shows now; recorded in qr_tokens (once per window).
     */
    public function issue(Kiosk $kiosk, CarbonInterface $now): QrCode
    {
        $window = $this->window($now);
        $locationId = $kiosk->office_location_id;
        $from = $this->windowStart($window);
        $until = $from->addSeconds($this->windowSeconds());

        QrToken::query()->createOrFirst(
            ['token_hash' => self::hashSignature($this->sign($locationId, $window))],
            [
                'office_location_id' => $locationId,
                'kiosk_id' => $kiosk->id,
                'window' => $window,
                'valid_from' => $from,
                'valid_until' => $until,
            ],
        );

        return new QrCode($this->payload($locationId, $window), $window, $from, $until);
    }

    /**
     * Validates a scanned payload and returns the displayed token.
     *
     * @throws AttendanceException qr_invalid | qr_expired
     */
    public function verify(string $payload, CarbonInterface $now): QrToken
    {
        $parsed = $this->parse($payload) ?? throw AttendanceException::qrInvalid();

        if (! hash_equals($this->sign($parsed->locationId, $parsed->window), $parsed->signature)) {
            throw AttendanceException::qrInvalid();
        }

        $current = $this->window($now);
        $tolerance = config()->integer('attendance.qr.tolerance_windows');

        if ($parsed->window < $current - $tolerance) {
            throw AttendanceException::qrExpired();
        }

        if ($parsed->window > $current + $tolerance) {
            throw AttendanceException::qrInvalid();
        }

        $token = QrToken::query()
            ->with('officeLocation')
            ->where('token_hash', self::hashSignature($parsed->signature))
            ->where('office_location_id', $parsed->locationId)
            ->where('window', $parsed->window)
            ->first();

        // Only codes an active kiosk really displayed count (a valid HMAC alone is not enough).
        if ($token === null || ($token->kiosk_id !== null && ! Kiosk::query()->whereKey($token->kiosk_id)->where('is_active', true)->exists())) {
            throw AttendanceException::qrInvalid();
        }

        return $token;
    }

    public function parse(string $payload): ?QrPayload
    {
        $payload = trim($payload);
        $scheme = config()->string('attendance.qr.scheme');

        if (strlen($payload) > 512 || ! str_starts_with($payload, $scheme.'?')) {
            return null;
        }

        parse_str(substr($payload, strlen($scheme) + 1), $query);
        $location = $query['l'] ?? null;
        $window = $query['w'] ?? null;
        $signature = $query['s'] ?? null;

        if (! is_string($location) || preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/i', $location) !== 1
            || ! is_string($window) || preg_match('/^\d{1,12}$/', $window) !== 1
            || ! is_string($signature) || preg_match('/^[0-9a-f]{'.self::SIGNATURE_LENGTH.'}$/', $signature) !== 1) {
            return null;
        }

        return new QrPayload(strtolower($location), (int) $window, $signature);
    }

    public static function hashSignature(string $signature): string
    {
        return hash('sha256', $signature);
    }

    private function windowSeconds(): int
    {
        return max(1, config()->integer('attendance.qr.window_seconds'));
    }

    /**
     * ATTENDANCE_QR_SECRET, or a key derived from APP_KEY when it is empty.
     */
    private function secret(): string
    {
        $secret = config('attendance.qr.secret');

        if (is_string($secret) && $secret !== '') {
            return $secret;
        }

        return hash_hmac('sha256', 'ruangkerja-attendance-qr', config()->string('app.key'));
    }
}
