<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Actions\CheckOut;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Attendance\CheckInController as WebCheckInController;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AttendanceCheckOutRequest;
use App\Http\Resources\Attendance\AttendancePresenter;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Check-out of the mobile app (POST /api/v1/absensi/check-out, multipart):
 * same payload as check-in without the work plan; refusal and success bodies
 * are identical to the web endpoint.
 */
class CheckOutController extends Controller
{
    public function __invoke(
        AttendanceCheckOutRequest $request,
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
