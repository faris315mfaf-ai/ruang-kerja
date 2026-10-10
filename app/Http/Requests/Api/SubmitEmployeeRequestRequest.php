<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Requests\SaveEmployeeRequestRequest;

/**
 * POST /api/v1/pengajuan — {type, ...payload}: the mobile app names the leave
 * type `type` (the web form's `leave_type_id` alias) and only submits —
 * drafts stay a web flow in Tahap 1, so `intent` is pinned to `submit`.
 * Everything else (rules, Indonesian messages, toInput) is inherited from
 * the web form; business rules are re-checked by SubmitRequest.
 */
final class SubmitEmployeeRequestRequest extends SaveEmployeeRequestRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'intent' => 'submit',
            'leave_type_id' => $this->input('leave_type_id') ?? $this->input('type'),
        ]);
    }
}
