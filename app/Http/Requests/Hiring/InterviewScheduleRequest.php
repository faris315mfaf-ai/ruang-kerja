<?php

namespace App\Http\Requests\Hiring;

use Illuminate\Contracts\Validation\ValidationRule;

/**
 * PUT /hiring/kandidat/{candidate}/wawancara: `interview_at` in office time
 * (`YYYY-MM-DD HH:MM`, also the `datetime-local` form), null/empty clears it.
 */
class InterviewScheduleRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'interview_at' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/'],
            'interview_location' => ['nullable', 'string', 'max:200'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['interview_at.regex' => 'Tanggal & jam wawancara tidak valid (format YYYY-MM-DD HH:MM).'];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['interview_at' => 'jadwal wawancara', 'interview_location' => 'tempat wawancara'];
    }

    public function scheduledAt(): ?string
    {
        $value = $this->input('interview_at');

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    public function location(): ?string
    {
        $value = $this->input('interview_location');

        return is_string($value) ? $value : null;
    }
}
