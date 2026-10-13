<?php

namespace App\Http\Controllers\Requests;

use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalFlowResolver;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\ColleagueAbsences;
use App\Domain\Requests\Services\OverlapDetector;
use App\Domain\Requests\Services\RequestWriter;
use App\Domain\Requests\Support\OfficeTime;
use App\Domain\Requests\Support\RequestFormatter;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Live summary of the request form ("Ringkasan"): working days, balance
 * before → after, overlap, colleagues absent, and the approval flow preview.
 * Read-only, nothing is stored.
 */
class RequestPreviewController extends Controller
{
    public function __construct(
        private readonly RequestWriter $writer,
        private readonly OverlapDetector $overlaps,
        private readonly ApprovalFlowResolver $flows,
        private readonly BalanceLedger $ledger,
        private readonly ColleagueAbsences $colleagues,
    ) {}

    public function __invoke(Request $http, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('create', EmployeeRequest::class);

        $typeId = $http->query('leave_type_id');
        $type = is_string($typeId) ? LeaveType::query()->visibleTo($user)->active()->find($typeId) : null;

        if ($type === null) {
            return response()->json(['message' => 'Jenis pengajuan tidak tersedia.'], 422);
        }

        $ignoreId = $http->query('request_id');
        $ignoreId = is_string($ignoreId) && EmployeeRequest::query()->ownedBy($user)->whereKey($ignoreId)->exists() ? $ignoreId : null;

        /** @var array<string, mixed> $query */
        $query = $http->query();
        $input = RequestInput::fromArray($type, $query);

        $request = new EmployeeRequest(['user_id' => $user->id, 'leave_type_id' => $type->id, 'payload' => []]);
        $request->setRelation('user', $user);
        $request->setRelation('leaveType', $type);
        $errors = null;
        $sendBlocked = null;
        $period = null;

        try {
            $period = $this->writer->period($user, $input);
            $request->fill([
                'start_at' => $period->startAt,
                'end_at' => $period->endAt,
                'days' => $period->days,
                'minutes' => $period->minutes,
                'payload' => $period->payload,
            ]);
        } catch (ValidationException $e) {
            $errors = array_map(fn (array $messages): string => (string) ($messages[0] ?? ''), $e->errors());
            $request->fill(['start_at' => OfficeTime::today()->utc(), 'end_at' => OfficeTime::today()->utc()]);
        }

        // Sakit/izin for today bound to the cutoff (keputusan pemilik 14 Okt 2026): the same
        // message the submit would return, so the form can disable "Kirim" before sending.
        if ($period !== null) {
            try {
                $this->writer->assertCanSend($type, $period, $ignoreId === null ? null : EmployeeRequest::query()->ownedBy($user)->find($ignoreId));
            } catch (ValidationException $e) {
                $errors = array_map(fn (array $messages): string => (string) ($messages[0] ?? ''), $e->errors());
                $sendBlocked = (string) (array_values($errors)[0] ?? '');
            }
        }

        $overlap = $period === null ? null : $this->overlaps->find($user, $type->category, $period->startAt, $period->endAt, $ignoreId);

        return response()->json([
            'period' => $period === null ? null : [
                'start_at' => $period->startAt->toIso8601String(),
                'end_at' => $period->endAt->toIso8601String(),
                'days' => $period->days,
                'minutes' => $period->minutes,
                'work_dates' => $period->workDates,
            ],
            'errors' => $errors,
            // Sending is refused by the same-day cutoff (the form disables "Kirim", a draft still saves).
            'send_blocked' => $sendBlocked,
            // Staff never see an annual leave balance (keputusan pemilik 6 Okt 2026).
            'balance' => $user->isStaffOnly() ? null : $this->balance($user, $type, $period?->startAt, $period?->days, $ignoreId),
            'overlap' => $overlap === null ? null : sprintf('Tumpang tindih dengan %s (%s, %s).', $overlap->number ?? 'draf', $overlap->leaveType->name, RequestFormatter::period($overlap)),
            'colleagues' => $period !== null && $type->category->isAbsence()
                ? $this->colleagues->around($user, $period->startAt, $period->endAt, $ignoreId)
                : null,
            'flow' => RequestPresenter::plannedSteps($this->flows->preview($request)),
            'attachment_required' => $type->requiresAttachmentFor((float) ($period->days ?? 0)),
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function balance(User $user, LeaveType $type, ?CarbonImmutable $startAt, ?float $days, ?string $ignoreId): ?array
    {
        $year = $startAt === null ? OfficeTime::today()->year : OfficeTime::local($startAt)->year;
        $balance = $this->ledger->peek($user, $type, $year);

        if ($balance === null) {
            return null;
        }

        // A request being edited may still hold a reservation (pending) — do not count it twice.
        $own = $ignoreId === null ? null : EmployeeRequest::query()->whereKey($ignoreId)->where('status', RequestStatus::Pending->value)->value('days');
        $available = $balance->available() + (is_numeric($own) ? (float) $own : 0.0);

        return [
            'year' => $year,
            'summary' => $balance->toSummary(),
            'before' => round($available, 1),
            'after' => round($available - ($days ?? 0), 1),
            'enough' => $available - ($days ?? 0) >= 0,
        ];
    }
}
