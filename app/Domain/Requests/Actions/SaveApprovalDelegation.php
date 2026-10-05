<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Models\ApprovalDelegation;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * "Delegasi saat penyetuju cuti": the signed-in approver names a stand-in for a period.
 */
final class SaveApprovalDelegation
{
    public function __construct(
        private readonly RouteToDelegates $route,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{delegate_id: string, starts_on: string, ends_on: string, reason?: string|null}  $data
     */
    public function handle(User $delegator, array $data): ApprovalDelegation
    {
        $delegate = User::query()->active()->where('company_id', $delegator->company_id)->find($data['delegate_id']);

        if ($delegate === null || $delegate->is($delegator)) {
            throw ValidationException::withMessages(['delegate_id' => 'Pilih rekan aktif lain sebagai delegasi.']);
        }

        $overlaps = ApprovalDelegation::query()
            ->where('delegator_id', $delegator->id)
            ->whereDate('starts_on', '<=', $data['ends_on'])
            ->whereDate('ends_on', '>=', $data['starts_on'])
            ->exists();

        if ($overlaps) {
            throw ValidationException::withMessages(['starts_on' => 'Sudah ada delegasi pada rentang tanggal ini.']);
        }

        $delegation = ApprovalDelegation::query()->create([
            'delegator_id' => $delegator->id,
            'delegate_id' => $delegate->id,
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
            'reason' => $data['reason'] ?? null,
        ]);

        $this->audit->log('approval_delegation.created', $delegation, null, [
            'delegate_id' => $delegate->id,
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
        ], $delegator);

        $this->route->handle($delegation);

        return $delegation;
    }
}
