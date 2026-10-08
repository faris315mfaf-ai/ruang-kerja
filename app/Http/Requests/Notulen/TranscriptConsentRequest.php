<?php

namespace App\Http\Requests\Notulen;

use App\Http\Requests\Meetings\MeetingRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/** PUT /rapat/{meeting}/notulen-otomatis/persetujuan — {opted_out}. */
class TranscriptConsentRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['opted_out' => ['required', 'boolean']];
    }
}
