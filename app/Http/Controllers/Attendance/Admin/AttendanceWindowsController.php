<?php

namespace App\Http\Controllers\Attendance\Admin;

use App\Domain\Attendance\Actions\SaveAttendanceWindows;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\AttendanceWindowsRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Admin › Jam absen: company-wide check-in / check-out hours (HR, Super Admin).
 */
class AttendanceWindowsController extends Controller
{
    public function update(AttendanceWindowsRequest $request, #[CurrentUser] User $user, SaveAttendanceWindows $save): RedirectResponse
    {
        Gate::authorize('manage', OfficeLocation::class);

        $windows = $save->handle($user, $request->windows());

        Inertia::flash('toast', ['type' => 'success', 'message' => $windows->isEmpty() ? 'Jam absen dikosongkan: tanpa batas.' : 'Jam absen disimpan.']);

        return back();
    }
}
