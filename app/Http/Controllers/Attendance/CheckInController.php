<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\CheckIn;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\CheckInRequest;
use App\Http\Resources\Attendance\AttendancePresenter;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * JSON endpoint (multipart): the client renders the success/failure screens
 * from the structured result; the same Action backs the Phase 3 mobile API.
 */
class CheckInController extends Controller
{
    public function __invoke(
        CheckInRequest $request,
        #[CurrentUser] User $user,
        CheckIn $checkIn,
        AttendancePresenter $presenter,
    ): JsonResponse {
        Gate::authorize('checkIn', AttendanceDay::class);

        try {
            $result = $checkIn->handle($user, $request->toData());
        } catch (AttendanceException $exception) {
            return self::rejected($exception);
        }

        return response()->json(['result' => $presenter->result($result)], 201);
    }

    public static function rejected(AttendanceException $exception): JsonResponse
    {
        return response()->json([
            'message' => $exception->getMessage(),
            'reason' => $exception->reason->value,
            'context' => $exception->context,
        ], 422);
    }
}
