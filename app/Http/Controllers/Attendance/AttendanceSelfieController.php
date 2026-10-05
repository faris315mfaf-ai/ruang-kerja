<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Domain\Organization\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Streams a selfie from the private disk. Requires a valid temporary signature
 * (middleware `signed`, 5 minutes) AND the viewSelfie policy. Viewing someone
 * else's selfie is written to audit_logs.
 */
class AttendanceSelfieController extends Controller
{
    public function __invoke(
        AttendanceLog $attendanceLog,
        #[CurrentUser] User $user,
        SelfieStorage $selfies,
        AuditLogger $audit,
    ): StreamedResponse {
        Gate::authorize('viewSelfie', $attendanceLog);

        if ($attendanceLog->user_id !== $user->id) {
            $audit->log('selfie.viewed', $attendanceLog, null, ['employee_id' => $attendanceLog->user_id]);
        }

        return $selfies->response($attendanceLog);
    }
}
