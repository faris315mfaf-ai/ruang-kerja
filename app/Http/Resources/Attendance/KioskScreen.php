<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Services\QrCodeService;
use App\Domain\Attendance\Services\QrImageRenderer;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Http\Resources\Attendance\Concerns\NamesPeople;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Data of the kiosk screen (mockup Kiosk): the current QR code and the latest
 * check-ins at this location. Public screen: first name + initial only.
 */
final class KioskScreen
{
    use NamesPeople;

    public function __construct(
        private readonly QrCodeService $codes,
        private readonly QrImageRenderer $images,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function state(Kiosk $kiosk, CarbonImmutable $now): array
    {
        $code = $this->codes->issue($kiosk, $now);

        Kiosk::query()->whereKey($kiosk->id)->update(['last_seen_at' => $now]);

        return [
            'code' => [
                'payload' => $code->payload,
                'svg' => $this->images->svg($code->payload),
                'window' => $code->window,
                'validFrom' => $code->validFrom->toIso8601ZuluString(),
                'validUntil' => $code->validUntil->toIso8601ZuluString(),
            ],
            'serverTime' => $now->toIso8601ZuluString('millisecond'),
            'recent' => $this->recent($kiosk, $now),
        ];
    }

    /**
     * @return list<array{id: string, name: string, initials: string, at: string|null}>
     */
    public function recent(Kiosk $kiosk, CarbonImmutable $now): array
    {
        $since = ScheduleResolver::officeDate($now)->utc();

        return array_values(AttendanceLog::query()
            ->with('user:id,name')
            ->where('office_location_id', $kiosk->office_location_id)
            ->where('type', AttendanceLogType::CheckIn->value)
            ->where('occurred_at', '>=', $since)
            ->orderByDesc('occurred_at')
            ->limit(config()->integer('attendance.qr.recent_check_ins'))
            ->get()
            ->map(fn (AttendanceLog $log): array => [
                'id' => $log->id,
                'name' => self::publicName($log->user->name),
                'initials' => self::initials($log->user->name),
                'at' => AttendancePresenter::iso($log->occurred_at),
            ])
            ->all());
    }

    /**
     * "Sari Wulandari" → "Sari W.", "Rizky" → "Rizky".
     */
    public static function publicName(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $first = $parts[0] ?? '';

        if (count($parts) < 2) {
            return $first;
        }

        return $first.' '.Str::upper(mb_substr((string) end($parts), 0, 1)).'.';
    }
}
