<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\CorrectAttendance;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\CorrectionRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Manual attendance correction by HR (method manual, reason, audit).
 */
class AttendanceCorrectionController extends Controller
{
    public function store(CorrectionRequest $request, #[CurrentUser] User $user, CorrectAttendance $correct): RedirectResponse
    {
        $employee = User::query()->findOrFail($request->string('user_id')->toString());

        Gate::authorize('correct', [AttendanceDay::class, $employee]);

        $correct->handle($user, $employee, $request->toData());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Absensi {$employee->name} dikoreksi."]);

        return back();
    }
}
