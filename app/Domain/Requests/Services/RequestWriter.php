<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Data\RequestPeriod;
use App\Domain\Requests\Enums\RequestCategory;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Shared by SaveRequestDraft and SubmitRequest: eligibility, filling the row
 * from the form, and attachment bookkeeping.
 */
final class RequestWriter
{
    public function __construct(
        private readonly RequestDurationCalculator $durations,
        private readonly RequestAttachmentStore $attachments,
    ) {}

    public function period(User $user, RequestInput $input): RequestPeriod
    {
        $this->assertCanUse($user, $input->leaveType);

        return $this->durations->compute($user, $input);
    }

    public function assertCanUse(User $user, LeaveType $type): void
    {
        if ($type->company_id !== $user->company_id || ! $type->is_active || $type->trashed()) {
            throw ValidationException::withMessages(['leave_type_id' => 'Jenis pengajuan tidak tersedia.']);
        }

        if (! $type->isEligible($user)) {
            throw ValidationException::withMessages(['leave_type_id' => "Anda belum berhak atas {$type->name}."]);
        }
    }

    /**
     * Fills the (unsaved) row from the input.
     */
    public function fill(EmployeeRequest $request, User $user, RequestInput $input, RequestPeriod $period): void
    {
        $existing = $request->exists ? $request->attachments()->count() : 0;
        $removing = $request->exists ? $request->attachments()->whereKey($input->removeAttachments)->count() : 0;
        $max = config()->integer('requests.attachments.max_files', 5);

        if ($existing - $removing + count($input->attachments) > $max) {
            throw ValidationException::withMessages(['attachments' => "Maksimal {$max} lampiran."]);
        }

        if ($input->substituteId !== null) {
            $substitute = User::query()->active()->where('company_id', $user->company_id)->find($input->substituteId);

            if ($substitute === null || $substitute->is($user)) {
                throw ValidationException::withMessages(['substitute_id' => 'Pengganti tidak valid.']);
            }
        }

        $request->fill([
            'user_id' => $user->id,
            'leave_type_id' => $input->leaveType->id,
            'start_at' => $period->startAt,
            'end_at' => $period->endAt,
            'days' => $period->days,
            'minutes' => $period->minutes,
            'reason' => $input->reason,
            'substitute_id' => $input->leaveType->category === RequestCategory::Leave ? $input->substituteId : null,
            'payload' => $period->payload,
        ]);
        $request->setRelation('user', $user);
        $request->setRelation('leaveType', $input->leaveType);
    }

    /**
     * After the row is saved: drops removed attachments and stores new files.
     *
     * @return array{stored: list<string>, removed: list<string>} file paths — delete
     *                                                            `stored` if the transaction fails, `removed` after it commits
     */
    public function syncAttachments(EmployeeRequest $request, User $user, RequestInput $input): array
    {
        $removed = $this->attachments->detach($request, $input->removeAttachments);
        $stored = $input->attachments === [] ? [] : $this->attachments->store($request, $user, $input->attachments);
        $request->unsetRelation('attachments');

        return ['stored' => $stored, 'removed' => $removed];
    }

    /**
     * @param  list<string>  $paths
     */
    public function deleteFiles(array $paths): void
    {
        $this->attachments->delete($paths);
    }

    public function assertAttachmentRule(EmployeeRequest $request): void
    {
        $type = $request->leaveType;

        if ($type->requiresAttachmentFor((float) ($request->days ?? 0)) && $request->attachments()->doesntExist()) {
            throw ValidationException::withMessages([
                'attachments' => $type->requires_attachment_after_days === 0
                    ? "{$type->name} wajib melampirkan berkas."
                    : "{$type->name} lebih dari {$type->requires_attachment_after_days} hari wajib melampirkan surat (mis. surat dokter).",
            ]);
        }
    }
}
