<?php

namespace App\Http\Requests\Meetings;

use Illuminate\Contracts\Validation\ValidationRule;

/** "X sedang menyunting" heartbeat (POST /rapat/{meeting}/notulen/menyunting). */
class MinutesEditingRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tanggal' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'active' => ['required', 'boolean'],
        ];
    }
}
