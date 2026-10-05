<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\CheckIn;
use App\Domain\Attendance\Actions\CheckOut;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\QrCheckInRequest;
use App\Http\Resources\Attendance\AttendancePresenter;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * JSON endpoints for a scanned kiosk QR code (method `qr`). Same result and
 * rejection shapes as the GPS + selfie endpoints.
 */
class QrCheckController extends Controller
{
    public function checkIn(
        QrCheckInRequest $request,
        #[CurrentUser] User $user,
        CheckIn $checkIn,
        AttendancePresenter $presenter,
    ): JsonResponse {
        Gate::authorize('checkIn', AttendanceDay::class);

        try {
            $result = $checkIn->handle($user, $request->toData());
        } catch (AttendanceException $exception) {
            return CheckInController::rejected($exception);
        }

        return response()->json(['result' => $presenter->result($result)], 201);
    }

    public function checkOut(
        QrCheckInRequest $request,
        #[CurrentUser] User $user,
        CheckOut $checkOut,
        AttendancePresenter $presenter,
    ): JsonResponse {
        Gate::authorize('checkIn', AttendanceDay::class);

        try {
            $result = $checkOut->handle($user, $request->toData());
        } catch (AttendanceException $exception) {
            return CheckInController::rejected($exception);
        }

        return response()->json(['result' => $presenter->result($result)], 201);
    }
}
