<?php

namespace App\Domain\Notifications\Jobs;

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Services\StampedSelfie;
use App\Domain\Notifications\Services\EvolutionWhatsApp;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Domain\Tenancy\Support\CurrentCompany;
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
 * WhatsApp group through the Evolution API gateway (owner decisions 8–13 Oct
 * 2026). Format:
 *
 * 🟢 ABSEN MASUK / 🔴 ABSEN PULANG, then Nama/Tanggal/Jam/Lokasi; the
 * morning message lists the day's "Rencana Kerja" points, the afternoon one
 * the "Laporan Kerja" points and the worked duration. A log pressed without
 * internet (flag `offline`) adds "⚠️ Absen offline — tersinkron 09.40" (office
 * time the server received it) after Lokasi; the photo stamp stays the device
 * time of the press.
 *
 * When the log has a selfie it is sent as a stamped photo (time, date, place,
 * mini map — `StampedSelfie`) with the text as its caption; without a selfie
 * (QR/kiosk) or when stamping fails the same text goes out as a plain
 * message. A caption over ~900 characters would be cut by WhatsApp, so the
 * photo then carries the header and the points follow as a second job
 * (`part = points`), keeping a retry from ever posting the photo twice.
 * Disabled while the channel is off; a failing gateway never affects the
 * attendance record itself. Sent only to the WhatsApp group of the
 * employee's company (`companies.settings.whatsapp.group_jid`,
 * CompanySettings); a company without a group gets no copy.
 */
final class SendAttendanceWhatsApp implements ShouldQueue
{
    use CompanyAware;
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public const string PART_FULL = 'full';

    /** Follow-up text with the points, after a photo whose caption was too long. */
    public const string PART_POINTS = 'points';

    /** WhatsApp cuts captions at ~1024 characters; stay clear of that. */
    private const int CAPTION_LIMIT = 900;

    public int $tries = 5;

    /** @var list<int> */
    public array $backoff = [60, 300, 900, 1800];

    public int $timeout = 30;

    public function __construct(
        public readonly string $dayId,
        public readonly AttendanceLogType $type,
        public readonly string $part = self::PART_FULL,
    ) {}

    public function handle(EvolutionWhatsApp $whatsapp, StampedSelfie $stamp): void
    {
        if (! $whatsapp->enabled()) {
            return;
        }

        $day = AttendanceDay::query()
            ->with(['user:id,name,company_id', 'checkInLog.officeLocation:id,name', 'checkOutLog.officeLocation:id,name'])
            ->find($this->dayId);

        if ($day === null || ! $day->user()->exists()) {
            return;
        }

        // Only the group of the employee's own company (Fase 1 multi-perusahaan).
        $group = $whatsapp->attendanceGroupFor($day->user->company_id);

        if ($group === null) {
            return;
        }

        $log = $this->type === AttendanceLogType::CheckIn ? $day->checkInLog : $day->checkOutLog;

        if ($log === null) {
            return;
        }

        if ($this->part === self::PART_POINTS) {
            $whatsapp->sendText($group, implode("\n", self::pointsSection($day, $log)));

            return;
        }

        $text = self::message($day, $log);
        $image = $log->selfie_path === null ? null : $stamp->render($log, self::location($log, $day->user->company_id));

        if ($image === null) {
            $whatsapp->sendText($group, $text);

            return;
        }

        if (mb_strlen($text) <= self::CAPTION_LIMIT) {
            $whatsapp->sendImage($group, $image, $text);

            return;
        }

        $whatsapp->sendImage($group, $image, implode("\n", self::headerLines($day, $log, withDuration: true)));

        // The photo is out: a failure to queue the follow-up must not make
        // this job retry (that would post the photo again).
        try {
            self::dispatch($this->dayId, $this->type, self::PART_POINTS);
        } catch (Throwable $e) {
            Log::warning('whatsapp.attendance follow-up not queued', ['day' => $this->dayId, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Full text (plain message, or the caption of the photo).
     *
     * @param  list<string>|null  $points  pre-normalised points overriding the stored plan/report (used by tests)
     */
    public static function message(AttendanceDay $day, AttendanceLog $log, ?array $points = null): string
    {
        $lines = self::headerLines($day, $log, withDuration: false);

        array_push($lines, ...self::pointsSection($day, $log, $points));

        if ($log->type === AttendanceLogType::CheckOut) {
            $lines[] = '';
            $lines[] = 'Durasi kerja: '.self::duration($day);
        }

        return implode("\n", $lines);
    }

    /**
     * Heading + Nama/Tanggal/Jam/Lokasi (and, for check-out when asked, the
     * duration — used when the points travel in a follow-up message).
     *
     * @return list<string>
     */
    private static function headerLines(AttendanceDay $day, AttendanceLog $log, bool $withDuration): array
    {
        $in = $log->type === AttendanceLogType::CheckIn;
        $at = (new CarbonImmutable($log->occurred_at))->setTimezone(CurrentCompany::timezone());

        $lines = [
            $in ? '🟢 ABSEN MASUK' : '🔴 ABSEN PULANG',
            'Nama: '.$day->user->name,
            'Tanggal: '.$at->settings(['locale' => 'id'])->translatedFormat('l, d F Y'),
            'Jam: '.$at->format('H.i'),
            'Lokasi: '.self::location($log, $day->user->company_id),
        ];

        // Pressed without internet: the stamp above is the device time of the
        // press; say when it actually reached the server.
        if ($log->flags->contains(LogFlag::Offline)) {
            $received = (new CarbonImmutable($log->received_at ?? $log->created_at))->setTimezone(CurrentCompany::timezone());
            $lines[] = '⚠️ Absen offline — tersinkron '.$received->format('H.i');
        }

        if ($withDuration && ! $in) {
            $lines[] = 'Durasi kerja: '.self::duration($day);
        }

        return $lines;
    }

    /**
     * Blank line, "📝 Rencana Kerja:" (check-in) or "📝 Laporan Kerja:"
     * (check-out) and the numbered points.
     *
     * @param  list<string>|null  $points
     * @return list<string>
     */
    private static function pointsSection(AttendanceDay $day, AttendanceLog $log, ?array $points = null): array
    {
        $in = $log->type === AttendanceLogType::CheckIn;
        $points ??= ($in ? $day->work_plan : $day->work_report) ?? [];
        $points = array_values(array_filter(array_map(fn ($point): string => trim((string) $point), $points), fn (string $point): bool => $point !== ''));

        $lines = ['', $in ? '📝 Rencana Kerja:' : '📝 Laporan Kerja:'];

        if ($points === []) {
            $lines[] = '_(tidak diisi — absen lewat QR/kiosk)_';
        } else {
            foreach ($points as $index => $point) {
                $lines[] = ($index + 1).'. '.$point;
            }
        }

        return $lines;
    }

    /**
     * Descriptive per condition: office geofence name, WFH (with its note),
     * or "Luar kantor · 1,2 km dari Kantor Pusat" (nearest office).
     */
    public static function location(AttendanceLog $log, string $companyId): string
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
            'part' => $this->part,
            'error' => $exception->getMessage(),
        ]);
    }
}
