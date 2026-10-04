<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\CheckInData;
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
    public function detect(User $user, CheckInData $data, CarbonInterface $now): array
    {
        $flags = [];

        if ($data->accuracyM !== null && $data->accuracyM > config()->integer('attendance.fraud.max_accuracy_m')) {
            $flags[] = LogFlag::LowAccuracy;
        }

        if ($data->clientTime !== null
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
            if ($data->deviceFingerprint !== null && ! $history->contains('device_fingerprint', $data->deviceFingerprint)) {
                $flags[] = LogFlag::NewDevice;
            }

            if ($data->ipAddress !== null && ! $history->contains('ip_address', $data->ipAddress)) {
                $flags[] = LogFlag::NewIp;
            }

            $previous = $history->first(fn (AttendanceLog $log): bool => $log->hasCoordinates());

            if ($previous !== null && $this->isImpossibleTravel($previous, $data, $now)) {
                $flags[] = LogFlag::ImpossibleTravel;
            }
        }

        if ($this->selfies->isDarkOrBlank($data->selfie)) {
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

    private function isImpossibleTravel(AttendanceLog $previous, CheckInData $data, CarbonInterface $now): bool
    {
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
