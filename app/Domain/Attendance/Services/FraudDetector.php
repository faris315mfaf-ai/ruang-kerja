<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Data\QrCheckInData;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Basic web fraud signals (docs/PRD.md M2). Flags only, never blocks.
 */
final class FraudDetector
{
    public function __construct(
        private readonly GeofenceService $geofence,
        private readonly SelfieInspector $selfies,
    ) {}

    /**
     * @return list<LogFlag>
     */
    public function detect(User $user, CheckInData|QrCheckInData $data, CarbonInterface $now): array
    {
        $flags = [];

        if ($data->accuracyM !== null && $data->accuracyM > config()->integer('attendance.fraud.max_accuracy_m')) {
            $flags[] = LogFlag::LowAccuracy;
        }

        // Reported by the native app (Location.mocked on Android); a signal for
        // HR review like every other flag, never a block.
        if ($data->mockLocation) {
            $flags[] = LogFlag::MockLocation;
        }

        // An offline press is judged at the device clock by design; the skew is expected.
        if (! $data->offline && $data->clientTime !== null
            && abs($now->getTimestamp() - $data->clientTime->getTimestamp()) > config()->integer('attendance.fraud.max_clock_skew_minutes') * 60) {
            $flags[] = LogFlag::ClockSkew;
        }

        /** @var Collection<int, AttendanceLog> $history */
        $history = AttendanceLog::query()
            ->where('user_id', $user->id)
            ->where('occurred_at', '<=', $now)
            ->orderByDesc('occurred_at')
            ->limit(config()->integer('attendance.fraud.history_size'))
            ->get(['id', 'occurred_at', 'latitude', 'longitude', 'ip_address', 'device_fingerprint']);

        if ($history->isNotEmpty()) {
            // Only compare against history that recorded the value at all.
            $devices = $history->pluck('device_fingerprint')->filter();
            $ips = $history->pluck('ip_address')->filter();

            if ($data->deviceFingerprint !== null && $devices->isNotEmpty() && ! $devices->contains($data->deviceFingerprint)) {
                $flags[] = LogFlag::NewDevice;
            }

            if ($data->ipAddress !== null && $ips->isNotEmpty() && ! $ips->contains($data->ipAddress)) {
                $flags[] = LogFlag::NewIp;
            }

            $previous = $history->first(fn (AttendanceLog $log): bool => $log->hasCoordinates());

            if ($previous !== null && $this->isImpossibleTravel($previous, $data, $now)) {
                $flags[] = LogFlag::ImpossibleTravel;
            }
        }

        if ($data instanceof CheckInData && $this->selfies->isDarkOrBlank($data->selfie)) {
            $flags[] = LogFlag::DarkSelfie;
        }

        return $flags;
    }

    /**
     * @param  list<LogFlag>  $flags
     */
    public static function isSuspicious(array $flags): bool
    {
        foreach ($flags as $flag) {
            if ($flag->raisesSuspicion()) {
                return true;
            }
        }

        return false;
    }

    private function isImpossibleTravel(AttendanceLog $previous, CheckInData|QrCheckInData $data, CarbonInterface $now): bool
    {
        if ($data->latitude === null || $data->longitude === null) {
            return false;
        }

        $distance = $this->geofence->distance(
            (float) $previous->latitude,
            (float) $previous->longitude,
            $data->latitude,
            $data->longitude,
        );

        if ($distance < config()->integer('attendance.fraud.min_travel_distance_m')) {
            return false;
        }

        $seconds = $now->getTimestamp() - $previous->occurred_at->getTimestamp();

        if ($seconds <= 0) {
            return true;
        }

        $kmh = ($distance / 1000) / ($seconds / 3600);

        return $kmh > config()->integer('attendance.fraud.max_speed_kmh');
    }
}
