<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Contracts\AttendanceEffects;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\RequestNotifier;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * HR (requests.cancel_approved) voids a request that was already approved:
 *
 * - status → canceled with canceled_by / canceled_at / cancel_reason (required);
 * - leave balance: the used days go back (BalanceLedger::refund);
 * - attendance: AttendanceEffects::revert() — absence rows without a check-in
 *   are removed and past dates closed again (no check-in = Alpha), worked days
 *   are unlinked, overtime is recalculated, a correction gets its original
 *   times back (refused when the corrected day changed since);
 * - audit `request.canceled_approved` (ids, numbers and counts only — the
 *   reason stays on the request);
 * - requester, approvers and substitute are notified (RequestNotifier).
 *
 * Any approved request may be canceled, also one whose dates have passed (the
 * confirm dialog warns about it). Never your own request.
 */
final class CancelApprovedRequest
{
    public const int REASON_MIN = 10;

    public function __construct(
        private readonly BalanceLedger $ledger,
        private readonly AttendanceEffects $attendance,
        private readonly CloseAttendanceDay $closeDay,
        private readonly RequestNotifier $notifier,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Who may cancel approved requests of this requester (status aside):
     * an active holder of requests.cancel_approved in the same company, never
     * for their own request.
     */
    public static function allowedFor(User $actor, EmployeeRequest $request): bool
    {
        $request->loadMissing('user');

        return $actor->isActive()
            && $actor->hasPermission(Permission::RequestsCancelApproved)
            && $request->user_id !== $actor->id
            && $request->user->company_id === $actor->company_id;
    }

    public static function reasonMax(): int
    {
        return config()->integer('requests.reason_max_length', 500);
    }

    /**
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function handle(User $actor, EmployeeRequest $request, string $reason): EmployeeRequest
    {
        $reason = trim($reason);

        if (mb_strlen($reason) < self::REASON_MIN) {
            throw ValidationException::withMessages(['reason' => 'Tulis alasan pembatalan minimal '.self::REASON_MIN.' karakter.']);
        }

        if (mb_strlen($reason) > self::reasonMax()) {
            throw ValidationException::withMessages(['reason' => 'Alasan pembatalan maksimal '.self::reasonMax().' karakter.']);
        }

        $request = DB::transaction(function () use ($actor, $request, $reason): EmployeeRequest {
            $request = EmployeeRequest::query()
                ->lockForUpdate()
                ->with(['user', 'leaveType', 'approvals.approver', 'substitute'])
                ->findOrFail($request->id);

            if (! self::allowedFor($actor, $request)) {
                throw new AuthorizationException('Anda tidak berwenang membatalkan pengajuan ini.');
            }

            if ($request->status !== RequestStatus::Approved) {
                throw ValidationException::withMessages(['reason' => $request->status === RequestStatus::Canceled
                    ? 'Pengajuan ini sudah dibatalkan.'
                    : 'Hanya pengajuan yang sudah disetujui yang bisa dibatalkan di sini.']);
            }

            $request->forceFill([
                'status' => RequestStatus::Canceled,
                'canceled_at' => now(),
                'canceled_by_id' => $actor->id,
                'cancel_reason' => $reason,
            ])->save();

            $refunded = $this->ledger->refund($request);
            // After the status change: overtime is recalculated from approved requests.
            $plan = $this->attendance->revert($request);

            // Past dates are closed again right away (today's run closes the rest);
            // closing is idempotent and never touches a day with a check-in.
            $today = OfficeTime::todayString();

            foreach ([...$plan->removedDates, $plan->correctionDate] as $date) {
                if ($date !== null && $date < $today) {
                    $this->closeDay->handleFor($request->user, CarbonImmutable::parse($date, OfficeTime::zone()));
                }
            }

            $this->audit->log('request.canceled_approved', $request, ['status' => RequestStatus::Approved->value], [
                'status' => RequestStatus::Canceled->value,
                'refunded_days' => $refunded,
                'removed_dates' => $plan->removedDates,
                'unlinked_dates' => $plan->unlinkedDates,
                'overtime_date' => $plan->overtimeDate,
                'correction_date' => $plan->correctionDate,
                // Privacy: a flag only; the reason itself lives on the request (in-app).
                'has_reason' => true,
            ], $actor);

            return $request;
        });

        $this->notifier->canceledAfterApproval($request, $actor);

        return $request;
    }
}
