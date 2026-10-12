<?php

namespace App\Http\Controllers\Api\Privacy;

use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Actions\RevokeAttendanceConsent;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Privacy\Services\ConsentOverview;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\GrantConsentRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Location + selfie consent (UU PDP) for the mobile app. Thin over the web
 * Actions: granting records both types for the current policy version
 * (idempotent), revoking withdraws everything and notifies HR (same as web).
 */
class ConsentController extends Controller
{
    public function show(#[CurrentUser] User $user, ConsentOverview $overview): JsonResponse
    {
        Gate::authorize('create', AttendanceConsent::class);

        return response()->json(['consent' => $overview->for($user)]);
    }

    public function store(
        #[CurrentUser] User $user,
        GrantConsentRequest $request,
        GiveAttendanceConsent $give,
        ConsentOverview $overview,
    ): JsonResponse {
        Gate::authorize('create', AttendanceConsent::class);

        $give->handle($user);

        return response()->json([
            'message' => 'Persetujuan data lokasi & selfie disimpan.',
            'consent' => $overview->for($user),
        ]);
    }

    public function destroy(
        #[CurrentUser] User $user,
        RevokeAttendanceConsent $revoke,
        ConsentOverview $overview,
    ): JsonResponse {
        Gate::authorize('revoke', AttendanceConsent::class);

        $revoked = $revoke->handle($user);

        return response()->json([
            'message' => 'Persetujuan data lokasi & selfie dicabut.',
            'revoked' => $revoked,
            'consent' => $overview->for($user),
        ]);
    }
}
