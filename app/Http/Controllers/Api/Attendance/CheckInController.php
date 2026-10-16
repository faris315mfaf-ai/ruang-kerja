<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Actions\CheckIn as CheckInAction;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Attendance\CheckInController as WebCheckInController;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AttendanceCheckInRequest;
use App\Http\Resources\Attendance\AttendancePresenter;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Check-in of the mobile app (POST /api/v1/absensi/check-in, multipart): the
 * web Action, policy and rejection structure, verbatim — a business refusal
 * answers 422 {message, reason, context} through the web controller's own
 * CheckInController::rejected(), success answers 201 {result} (Attendance
 * Presenter: auto work-plan tasks and the WhatsApp copy are handled by the
 * Action itself).
 */
class CheckInController extends Controller
{
    public function __invoke(
        AttendanceCheckInRequest $request,
        #[CurrentUser] User $user,
        CheckInAction $checkIn,
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
}
