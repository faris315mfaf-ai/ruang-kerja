<?php

namespace App\Http\Requests\Notulen;

use App\Http\Requests\Meetings\MeetingRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/** PUT /rapat/{meeting}/notulen-otomatis/pengaturan — {auto_minutes}. */
class AutoMinutesRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['auto_minutes' => ['required', 'boolean']];
    }
}
