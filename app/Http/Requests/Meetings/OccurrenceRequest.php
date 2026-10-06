<?php

namespace App\Http\Requests\Meetings;

use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Plain action on a meeting occurrence (cancel, finalize, reopen, remind):
 * only the optional occurrence date of a series.
 */
class OccurrenceRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['tanggal' => ['sometimes', 'nullable', 'date_format:Y-m-d']];
    }
}
