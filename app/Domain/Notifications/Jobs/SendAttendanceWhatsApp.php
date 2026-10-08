<?php

namespace App\Domain\Notifications\Jobs;

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Notifications\Services\EvolutionWhatsApp;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Best-effort copy of a successful check-in/check-out to the management
 * WhatsApp group through the Evolution API gateway (owner decision 8–9 Oct
 * 2026). Format (9 Oct):
 *
 * 🟢 ABSEN MASUK / 🔴 ABSEN PULANG, then Nama/Tanggal/Jam/Lokasi; the
 * morning message lists the day's work-plan points, the afternoon one the
 * worked duration instead. Disabled while the channel is off; a failing
 * gateway never affects the attendance record itself.
 */
final class SendAttendanceWhatsApp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    /** @var list<int> */
    public array $backoff = [60, 300, 900, 1800];

    public int $timeout = 30;

    public function __construct(
        public readonly string $dayId,
        public readonly AttendanceLogType $type,
    ) {}

    public function handle(EvolutionWhatsApp $whatsapp): void
    {
        $group = config('notifications.channels.whatsapp.group_jid');

        if (! $whatsapp->enabled() || ! is_string($group) || $group === '') {
            return;
        }

        $day = AttendanceDay::query()
            ->with(['user:id,name,company_id', 'checkInLog.officeLocation:id,name', 'checkOutLog.officeLocation:id,name'])
            ->find($this->dayId);

        if ($day === null || ! $day->user()->exists()) {
            return;
        }

        $log = $this->type === AttendanceLogType::CheckIn ? $day->checkInLog : $day->checkOutLog;

        if ($log === null) {
            return;
        }

        $whatsapp->sendText($group, self::message($day, $log));
    }

    /**
     * @param  list<string>|null  $plan  pre-normalised points (used by tests)
     */
    public static function message(AttendanceDay $day, AttendanceLog $log, ?array $plan = null): string
    {
        $in = $log->type === AttendanceLogType::CheckIn;
        $at = (new CarbonImmutable($log->occurred_at))->setTimezone(config('app.office_timezone'));

        $lines = [
            $in ? '🟢 ABSEN MASUK' : '🔴 ABSEN PULANG',
            'Nama: '.$day->user->name,
            'Tanggal: '.$at->settings(['locale' => 'id'])->translatedFormat('l, d F Y'),
            'Jam: '.$at->format('H.i'),
            'Lokasi: '.self::location($log, $day->user->company_id),
        ];

        if ($in) {
            $points = $plan ?? $day->work_plan ?? [];
            $points = array_values(array_filter(array_map(fn ($point): string => trim((string) $point), $points)));

            $lines[] = '';
            $lines[] = '📝 Rencana/Laporan Kerja Hari Ini:';

            if ($points === []) {
                $lines[] = '_(tidak diisi — absen lewat QR/kiosk)_';
            } else {
                foreach ($points as $index => $point) {
                    $lines[] = ($index + 1).'. '.$point;
                }
            }
        } else {
            $lines[] = 'Durasi kerja: '.self::duration($day);
        }

        return implode("\n", $lines);
    }

    /**
     * Descriptive per condition: office geofence name, WFH (with its note),
     * or "Luar kantor · 1,2 km dari Kantor Pusat" (nearest office).
     */
    private static function location(AttendanceLog $log, string $companyId): string
    {
        if ($log->officeLocation !== null) {
            return $log->officeLocation->name;
        }

        if ($log->method === AttendanceMethod::Wfh) {
            $note = trim((string) $log->note);

            return $note === '' ? 'WFH' : 'WFH — '.Str::limit($note, 60);
        }

        if ($log->latitude !== null && $log->longitude !== null) {
            $nearest = OfficeLocation::query()
                ->where('company_id', $companyId)
                ->where('is_active', true)
                ->get(['id', 'name', 'latitude', 'longitude'])
                ->map(fn (OfficeLocation $office): array => [
                    'name' => $office->name,
                    'distance' => self::haversineM((float) $log->latitude, (float) $log->longitude, $office->latitude, $office->longitude),
                ])
                ->sortBy('distance')
                ->first();

            if ($nearest !== null) {
                $distance = $nearest['distance'] >= 1000
                    ? number_format($nearest['distance'] / 1000, 1, ',', '.').' km'
                    : round($nearest['distance']).' m';

                return 'Luar kantor · '.$distance.' dari '.$nearest['name'];
            }
        }

        return '—';
    }

    private static function haversineM(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * $r * asin(sqrt($a));
    }

    private static function duration(AttendanceDay $day): string
    {
        // The afternoon copy only runs on a checked-out day, so both stamps
        // are set; work_minutes is the official figure (break deducted).
        $minutes = (int) $day->work_minutes;
        $checkIn = $day->check_in_at instanceof CarbonImmutable ? $day->check_in_at : null;
        $checkOut = $day->check_out_at instanceof CarbonImmutable ? $day->check_out_at : null;

        if ($minutes === 0 && $checkIn !== null && $checkOut !== null) {
            $minutes = (int) round($checkIn->diffInSeconds($checkOut) / 60);
        }

        $minutes = max(0, $minutes);
        $hours = intdiv($minutes, 60);
        $rest = $minutes % 60;

        return match (true) {
            $hours === 0 => $rest.' menit',
            $rest === 0 => $hours.' jam',
            default => $hours.' jam '.$rest.' menit',
        };
    }

    public function failed(Throwable $exception): void
    {
        // The group copy is additive; record the loss without noise.
        Log::warning('whatsapp.attendance not delivered', [
            'day' => $this->dayId,
            'type' => $this->type->value,
            'error' => $exception->getMessage(),
        ]);
    }
}
