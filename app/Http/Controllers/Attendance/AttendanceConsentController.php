<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Actions\RevokeAttendanceConsent;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class AttendanceConsentController extends Controller
{
    /**
     * "Setujui & lanjutkan" on the consent screen (current policy version).
     */
    public function store(#[CurrentUser] User $user, GiveAttendanceConsent $giveConsent): RedirectResponse
    {
        Gate::authorize('create', AttendanceConsent::class);

        $giveConsent->handle($user);

        return back();
    }

    /**
     * "Cabut persetujuan": check-in is refused until consent is given again.
     */
    public function destroy(#[CurrentUser] User $user, RevokeAttendanceConsent $revokeConsent): RedirectResponse
    {
        Gate::authorize('revoke', AttendanceConsent::class);

        $revokeConsent->handle($user);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Persetujuan data lokasi & selfie dicabut.']);

        return back();
    }
}
