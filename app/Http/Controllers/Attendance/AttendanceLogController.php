<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\MarkLogReviewed;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * HR review of flagged logs and on-demand selfie links.
 */
class AttendanceLogController extends Controller
{
    /**
     * A fresh 5-minute signed URL, requested when "Lihat selfie" is clicked
     * (the image request itself is audited).
     */
    public function selfieUrl(AttendanceLog $attendanceLog, SelfieStorage $selfies): JsonResponse
    {
        Gate::authorize('viewSelfie', $attendanceLog);

        $url = $selfies->temporaryUrl($attendanceLog);
        abort_if($url === null, 404, 'Selfie sudah dihapus sesuai masa retensi.');

        return response()->json(['url' => $url])->header('Cache-Control', 'no-store');
    }

    public function review(AttendanceLog $attendanceLog, #[CurrentUser] User $user, MarkLogReviewed $review): RedirectResponse
    {
        Gate::authorize('review', $attendanceLog);

        $review->handle($user, $attendanceLog);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Log {$attendanceLog->user->name} ditandai sudah ditinjau."]);

        return back();
    }
}
