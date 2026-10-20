<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Attendance\Actions\ClearAttendanceDay;
use App\Domain\Attendance\Actions\SetAttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Attendance\Concerns\FindsCompanyEmployee;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\ClearAttendanceDayRequest;
use App\Http\Requests\Attendance\SetAttendanceStatusRequest;
use App\Http\Resources\Attendance\AttendancePresenter;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Absen pegawai from the phone (keputusan pemilik 20 Okt 2026): the web
 * FormRequests, AttendanceDayPolicy::setStatus / clear and the web Actions
 * SetAttendanceStatus / ClearAttendanceDay (audit `attendance.status_set` /
 * `attendance.day_cleared`).
 */
class AttendanceDayController extends Controller
{
    use FindsCompanyEmployee;

    public function update(SetAttendanceStatusRequest $request, string $employee, string $date, #[CurrentUser] User $user, SetAttendanceStatus $action, AttendancePresenter $presenter): JsonResponse
    {
        $person = $this->companyEmployee($user, $employee);
        $workDate = $this->officeDate($date);

        Gate::authorize('setStatus', [AttendanceDay::class, $person]);

        $day = $action->handle($user, $person, $workDate->toDateString(), $request->status(), $request->time('check_in'), $request->time('check_out'), $request->reason());
        $day->load(['shift', 'checkInLog.officeLocation', 'checkOutLog.officeLocation']);

        return response()->json([
            'message' => "Status {$person->name} diatur: {$day->status->label()}.",
            'day' => $presenter->day($day),
        ]);
    }

    public function destroy(ClearAttendanceDayRequest $request, string $employee, string $date, #[CurrentUser] User $user, ClearAttendanceDay $action): JsonResponse
    {
        $person = $this->companyEmployee($user, $employee);
        $workDate = $this->officeDate($date);

        Gate::authorize('clear', [AttendanceDay::class, $person]);

        $action->handle($user, $person, $workDate->toDateString(), $request->reason());

        return response()->json(['message' => "Catatan absensi {$person->name} dihapus.", 'day' => null]);
    }
}
