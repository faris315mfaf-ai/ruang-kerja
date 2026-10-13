<?php

namespace App\Http\Requests\Api\Pengajuan;

use App\Http\Requests\Requests\SaveApprovalDelegationRequest;
use App\Models\ApprovalDelegation;

/**
 * PATCH /persetujuan/delegasi/{id}: the web delegation rules, with the fields
 * not sent taken from the stored delegation (change only the end date, …).
 */
final class UpdateDelegationApiRequest extends SaveApprovalDelegationRequest
{
    protected function prepareForValidation(): void
    {
        $delegation = $this->route('delegation');

        if (! $delegation instanceof ApprovalDelegation) {
            return;
        }

        /** @var array<string, mixed> $sent */
        $sent = $this->input();

        $this->replace([
            'delegate_id' => $delegation->delegate_id,
            'starts_on' => $delegation->starts_on->toDateString(),
            'ends_on' => $delegation->ends_on->toDateString(),
            'reason' => $delegation->reason,
            ...$sent,
        ]);
    }
}
