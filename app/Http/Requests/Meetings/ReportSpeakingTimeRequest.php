<?php

namespace App\Http\Requests\Meetings;

use App\Domain\Meetings\Actions\ReportSpeakingTime;
use Illuminate\Contracts\Validation\ValidationRule;

/** The browser's own accumulated speaking time (POST /rapat/{meeting}/video/bicara). */
class ReportSpeakingTimeRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tanggal' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'ms' => ['required', 'integer', 'min:0', 'max:'.ReportSpeakingTime::MAX_MS],
        ];
    }

    public function milliseconds(): int
    {
        return (int) $this->input('ms');
    }
}
