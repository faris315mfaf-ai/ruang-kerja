<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Data\LocationVerdict;
use App\Domain\Attendance\Data\QrCheckInData;
use App\Domain\Attendance\Data\QrVerdict;
use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Inserts the immutable attendance_logs row of a GPS/WFH/QR check-in or
 * check-out.
 */
final class AttendanceLogWriter
{
    /**
     * @param  list<LogFlag>  $flags
     */
    public function write(
        User $user,
        AttendanceDay $day,
        AttendanceLogType $type,
        CheckInData|QrCheckInData $data,
        LocationVerdict $location,
        array $flags,
        ?string $selfiePath,
        CarbonImmutable $now,
        ?QrVerdict $qr = null,
    ): AttendanceLog {
        $note = $data instanceof CheckInData && $data->note !== null ? trim($data->note) : null;
        $distance = $qr !== null ? $qr->distanceM : $location->match?->distanceM;

        return AttendanceLog::query()->create([
            'user_id' => $user->id,
            'attendance_day_id' => $day->id,
            'type' => $type,
            'method' => $location->method,
            'occurred_at' => $now->utc(),
            'client_time' => $data->clientTime?->utc(),
            'latitude' => $data->latitude === null ? null : round($data->latitude, 7),
            'longitude' => $data->longitude === null ? null : round($data->longitude, 7),
            'accuracy_m' => $data->accuracyM === null ? null : round($data->accuracyM, 2),
            // The matched geofence only when inside it; the distance to the closest one always.
            'office_location_id' => $location->match !== null && $location->match->inside ? $location->match->location->id : null,
            'distance_m' => $distance === null ? null : round($distance, 2),
            'selfie_path' => $selfiePath,
            'qr_token_id' => $qr?->token->id,
            'ip_address' => $data->ipAddress,
            'user_agent' => $data->userAgent === null ? null : Str::limit($data->userAgent, 509),
            'device_fingerprint' => $data->deviceFingerprint === null ? null : Str::limit($data->deviceFingerprint, 125),
            'flags' => $flags,
            'is_suspicious' => FraudDetector::isSuspicious($flags),
            'note' => $note === '' ? null : $note,
        ]);
    }
}
