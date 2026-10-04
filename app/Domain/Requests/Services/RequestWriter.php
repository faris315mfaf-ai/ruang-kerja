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
     * Fills the (unsaved) row from the input. Returns the paths of existing
     * attachments the user removed, to delete after the transaction commits.
     *
     * @return list<string>
     */
    public function fill(EmployeeRequest $request, User $user, RequestInput $input, RequestPeriod $period): array
    {
        $kept = [];
        $removed = [];

        foreach ($request->exists ? $request->attachments() : [] as $index => $attachment) {
            if (in_array($index, $input->removeAttachments, true)) {
                $removed[] = $attachment['path'];
            } else {
                $kept[] = $attachment;
            }
        }

        $max = config()->integer('requests.attachments.max_files', 5);

        if (count($kept) + count($input->attachments) > $max) {
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
            'payload' => [...$period->payload, 'attachments' => $kept],
        ]);
        $request->setRelation('user', $user);
        $request->setRelation('leaveType', $input->leaveType);

        return $removed;
    }

    /**
     * Stores the new files of the input on the saved request.
     *
     * @return list<string> stored paths (to clean up if the transaction fails)
     */
    public function storeNewAttachments(EmployeeRequest $request, RequestInput $input): array
    {
        if ($input->attachments === []) {
            return [];
        }

        $stored = $this->attachments->store($request, $input->attachments);
        $request->payload = [...$request->payload, 'attachments' => [...$request->attachments(), ...$stored]];
        $request->save();

        return array_column($stored, 'path');
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

        if ($type->requiresAttachmentFor((float) ($request->days ?? 0)) && $request->attachments() === []) {
            throw ValidationException::withMessages([
                'attachments' => $type->requires_attachment_after_days === 0
                    ? "{$type->name} wajib melampirkan berkas."
                    : "{$type->name} lebih dari {$type->requires_attachment_after_days} hari wajib melampirkan surat (mis. surat dokter).",
            ]);
        }
    }
}
