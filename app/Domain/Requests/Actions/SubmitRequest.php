<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalFlowResolver;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\OverlapDetector;
use App\Domain\Requests\Services\RequestNotifier;
use App\Domain\Requests\Services\RequestNumberGenerator;
use App\Domain\Requests\Services\RequestWriter;
use App\Domain\Requests\Support\RequestFormatter;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Sends a request for approval (new, a draft, or a revision → next round):
 * validates period, overlap, attachments and balance; numbers it; reserves the
 * balance (pending); plans the flow and notifies the first approver.
 */
final class SubmitRequest
{
    public function __construct(
        private readonly RequestWriter $writer,
        private readonly OverlapDetector $overlaps,
        private readonly BalanceLedger $ledger,
        private readonly RequestNumberGenerator $numbers,
        private readonly ApprovalFlowResolver $flows,
        private readonly RequestNotifier $notifier,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $user, RequestInput $input, ?EmployeeRequest $existing = null): EmployeeRequest
    {
        if ($existing !== null && ($existing->user_id !== $user->id || ! $existing->status->isEditable())) {
            throw ValidationException::withMessages(['status' => 'Pengajuan ini tidak bisa dikirim lagi.']);
        }

        $period = $this->writer->period($user, $input);

        $overlap = $this->overlaps->find($user, $input->leaveType->category, $period->startAt, $period->endAt, $existing?->id);

        if ($overlap !== null) {
            throw ValidationException::withMessages([
                'start_date' => sprintf(
                    'Tumpang tindih dengan pengajuan %s (%s, %s).',
                    $overlap->number ?? 'lain',
                    $overlap->leaveType->name,
                    RequestFormatter::period($overlap),
                ),
            ]);
        }

        $stored = [];

        try {
            /** @var array{0: EmployeeRequest, 1: list<string>, 2: RequestApproval} $result */
            $result = DB::transaction(function () use ($user, $input, $period, $existing, &$stored): array {
                $request = $existing === null ? new EmployeeRequest : EmployeeRequest::query()->lockForUpdate()->findOrFail($existing->id);

                if ($request->exists && ! $request->status->isEditable()) {
                    throw ValidationException::withMessages(['status' => 'Pengajuan ini tidak bisa dikirim lagi.']);
                }

                $previousStatus = $request->exists ? $request->status : null;
                $removed = $this->writer->fill($request, $user, $input, $period);

                $request->forceFill([
                    'status' => RequestStatus::Pending,
                    'round' => $previousStatus === RequestStatus::RevisionRequested ? $request->round + 1 : $request->round,
                    'submitted_at' => now(),
                    'decided_at' => null,
                    'current_step' => null,
                ]);
                $request->number ??= $this->numbers->next($input->leaveType, now());
                $request->save();

                $stored = $this->writer->storeNewAttachments($request, $input);
                $this->writer->assertAttachmentRule($request);
                $this->ledger->reserve($request);
                $step = $this->flows->start($request);

                $this->audit->log('request.submitted', $request, $previousStatus === null ? null : ['status' => $previousStatus->value], [
                    'number' => $request->number,
                    'status' => $request->status->value,
                    'round' => $request->round,
                ], $user);

                return [$request, $removed, $step];
            });
        } catch (Throwable $e) {
            $this->writer->deleteFiles($stored);

            throw $e;
        }

        [$request, $removed, $step] = $result;
        $this->writer->deleteFiles($removed);
        $this->notifier->awaitingApproval($request, $step);

        return $request;
    }
}
