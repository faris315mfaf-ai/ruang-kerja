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
 * (middleware `signed`, 5 minutes) AND the viewSelfie policy. Every access —
 * also the employee's own — is written to audit_logs (docs/PROMPTS.md Sprint 3).
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

        $audit->log('selfie.viewed', $attendanceLog, null, [
            'employee_id' => $attendanceLog->user_id,
            'own' => $attendanceLog->user_id === $user->id,
        ]);

        return $selfies->response($attendanceLog);
    }
}
