<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\CheckOut;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\CheckInRequest;
use App\Http\Resources\Attendance\AttendancePresenter;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class CheckOutController extends Controller
{
    public function __invoke(
        CheckInRequest $request,
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
