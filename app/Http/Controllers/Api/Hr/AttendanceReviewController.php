<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Attendance\Actions\MarkLogReviewed;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Domain\Organization\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\AttendancePresenter;
use App\Http\Resources\Attendance\TodayBoard;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * "Perlu ditinjau" for the Android app: flagged logs nobody reviewed yet
 * (TodayBoard::suspiciousQuery = the web board's list, paginated), "Tandai
 * sudah ditinjau" (MarkLogReviewed, AttendanceLogPolicy::review = HR / Super
 * Admin, never one's own; audited) and the selfie. Selfie access follows
 * AttendanceLogPolicy::viewSelfie (HR via attendance.view_selfie, the
 * employee's direct manager, the employee): the app asks for a short-lived
 * signed API URL, then fetches the image WITH its Bearer token; every image
 * fetch is audited as `selfie.viewed`, exactly like the web route.
 */
class AttendanceReviewController extends Controller
{
    public const int PER_PAGE = 20;

    public function index(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewTeam', AttendanceDay::class);

        $page = TodayBoard::suspiciousQuery($user)
            ->with(TodayBoard::SUSPICIOUS_RELATIONS)
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE);

        return response()->json([
            'items' => array_values($page->getCollection()->map(fn (AttendanceLog $log): array => TodayBoard::suspiciousItem($log, $user))->all()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'from' => $page->firstItem(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'to' => $page->lastItem(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function review(AttendanceLog $attendanceLog, #[CurrentUser] User $user, MarkLogReviewed $review): JsonResponse
    {
        Gate::authorize('review', $attendanceLog);

        $log = $review->handle($user, $attendanceLog);
        $log->loadMissing('user:id,name');
        $reviewer = $log->reviewed_by === null ? null : User::query()->find($log->reviewed_by, ['id', 'name']);

        return response()->json([
            'message' => "Log {$log->user->name} ditandai sudah ditinjau.",
            'log' => [
                'id' => $log->id,
                'reviewed_at' => AttendancePresenter::iso($log->reviewed_at),
                'reviewed_by' => $reviewer?->only(['id', 'name']),
            ],
        ]);
    }

    /**
     * A fresh signed link to the API selfie route (5 minutes,
     * attendance.selfie.url_ttl_minutes). 404 once retention removed it.
     */
    public function selfieUrl(AttendanceLog $attendanceLog): JsonResponse
    {
        Gate::authorize('viewSelfie', $attendanceLog);

        abort_if($attendanceLog->selfie_path === null, 404, 'Selfie sudah dihapus sesuai masa retensi.');

        $expiresAt = CarbonImmutable::now()->addMinutes(config()->integer('attendance.selfie.url_ttl_minutes'));

        return response()->json([
            'url' => URL::temporarySignedRoute('api.v1.hr.attendance.selfie', $expiresAt, ['attendanceLog' => $attendanceLog->id]),
            'expires_at' => $expiresAt->toIso8601String(),
        ])->header('Cache-Control', 'no-store');
    }

    /**
     * The image itself (middleware `signed` + Bearer + Policy), audited.
     */
    public function selfie(AttendanceLog $attendanceLog, #[CurrentUser] User $user, SelfieStorage $selfies, AuditLogger $audit): StreamedResponse
    {
        Gate::authorize('viewSelfie', $attendanceLog);

        $audit->log('selfie.viewed', $attendanceLog, null, [
            'employee_id' => $attendanceLog->user_id,
            'own' => $attendanceLog->user_id === $user->id,
        ]);

        return $selfies->response($attendanceLog);
    }
}
