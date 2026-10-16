<?php

namespace App\Http\Requests\Api\Meetings;

use App\Http\Requests\Meetings\MeetingRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * POST /api/v1/rapat/{meeting}/tindak-lanjut/{item}/jadikan-tugas: one
 * follow-up → task. The follow-up must belong to the meeting and the
 * meeting must be visible (MeetingRequest → 404 otherwise).
 */
class ConvertActionItemRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['workspace_id' => ['sometimes', 'nullable', 'string', 'ulid']];
    }
}
