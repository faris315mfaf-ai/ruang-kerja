<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Attendance\Actions\CorrectAttendance;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\CorrectionRequest;
use App\Http\Resources\Attendance\AttendancePresenter;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Manual attendance correction from the phone: the web FormRequest
 * (CorrectionRequest: reason required, HH:MM), AttendanceDayPolicy::correct
 * (HR / Super Admin of the same company, never oneself) and the web Action
 * CorrectAttendance (method manual log, audit `attendance.corrected`). No
 * offline queue: the app disables Simpan offline.
 */
class AttendanceCorrectionController extends Controller
{
    public function __invoke(CorrectionRequest $request, #[CurrentUser] User $user, CorrectAttendance $correct, AttendancePresenter $presenter): JsonResponse
    {
        $employee = User::query()->findOrFail($request->string('user_id')->toString());

        Gate::authorize('correct', [AttendanceDay::class, $employee]);

        $day = $correct->handle($user, $employee, $request->toData());
        $day->load(['shift', 'checkInLog.officeLocation', 'checkOutLog.officeLocation']);

        return response()->json([
            'message' => "Absensi {$employee->name} dikoreksi.",
            'day' => $presenter->day($day),
        ]);
    }
}
