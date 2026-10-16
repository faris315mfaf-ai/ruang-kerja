<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Actions\CheckIn;
use App\Domain\Attendance\Actions\CheckOut;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Attendance\CheckInController as WebCheckInController;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AttendanceQrRequest;
use App\Http\Resources\Attendance\AttendancePresenter;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Kiosk QR check-in/out of the mobile app (POST /api/v1/absensi/check-in/qr,
 * /check-out/qr): the web Actions and Policy with method `qr`; refusal bodies
 * ({message, reason, context} 422 — qr_invalid, qr_expired, qr_wrong_location,
 * qr_location_required, consent_required, …) and the 201 {result} body are
 * identical to the GPS endpoints and the web.
 */
class QrCheckController extends Controller
{
    public function checkIn(
        AttendanceQrRequest $request,
        #[CurrentUser] User $user,
        CheckIn $checkIn,
        AttendancePresenter $presenter,
    ): JsonResponse {
        Gate::authorize('checkIn', AttendanceDay::class);

        try {
            $result = $checkIn->handle($user, $request->toData());
        } catch (AttendanceException $exception) {
            return WebCheckInController::rejected($exception);
        }

        return response()->json(['result' => $presenter->result($result)], 201);
    }

    public function checkOut(
        AttendanceQrRequest $request,
        #[CurrentUser] User $user,
        CheckOut $checkOut,
        AttendancePresenter $presenter,
    ): JsonResponse {
        Gate::authorize('checkIn', AttendanceDay::class);

        try {
            $result = $checkOut->handle($user, $request->toData());
        } catch (AttendanceException $exception) {
            return WebCheckInController::rejected($exception);
        }

        return response()->json(['result' => $presenter->result($result)], 201);
    }
}
