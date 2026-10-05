<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\RequestWriter;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * "Simpan draf": stores the form without a number, balance reservation or flow.
 * On a request sent back for revision the content is updated and it stays
 * `revision_requested` until submitted again.
 */
final class SaveRequestDraft
{
    public function __construct(private readonly RequestWriter $writer) {}

    public function handle(User $user, RequestInput $input, ?EmployeeRequest $existing = null): EmployeeRequest
    {
        if ($existing !== null && ($existing->user_id !== $user->id || ! $existing->status->isEditable())) {
            throw ValidationException::withMessages(['status' => 'Pengajuan ini tidak bisa diubah lagi.']);
        }

        $period = $this->writer->period($user, $input);
        $stored = [];

        try {
            [$request, $removed] = DB::transaction(function () use ($user, $input, $period, $existing, &$stored): array {
                $request = $existing === null ? new EmployeeRequest : EmployeeRequest::query()->lockForUpdate()->findOrFail($existing->id);

                if ($request->exists && ! $request->status->isEditable()) {
                    throw ValidationException::withMessages(['status' => 'Pengajuan ini tidak bisa diubah lagi.']);
                }

                $this->writer->fill($request, $user, $input, $period);
                $request->status = $request->exists ? $request->status : RequestStatus::Draft;
                $request->save();
                ['stored' => $stored, 'removed' => $removed] = $this->writer->syncAttachments($request, $user, $input);

                return [$request, $removed];
            });
        } catch (Throwable $e) {
            $this->writer->deleteFiles($stored);

            throw $e;
        }

        $this->writer->deleteFiles($removed);

        return $request;
    }
}
